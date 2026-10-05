import json
import logging
import urllib.request
from typing import Optional, Dict, Any, List
import jwt
from sqlalchemy.orm import Session
from backend.app.config import COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_REGION, AWS_ENDPOINT_URL
from backend.app.models.user import User
from backend.app.adapters.auth.base import AuthAdapter

logger = logging.getLogger(__name__)


class CognitoAuthAdapter(AuthAdapter):
    """
    AWS Cognito User Pool JWT Authentication Adapter.
    Enforces cryptographically verified RS256 signature against public JWKS,
    issuer matching, audience/client_id validation, expiration, and token_use constraints.
    """

    def __init__(
        self,
        user_pool_id: str = COGNITO_USER_POOL_ID,
        client_id: str = COGNITO_CLIENT_ID,
        region: str = COGNITO_REGION,
        jwks: Optional[Dict[str, Any]] = None,
        issuer: Optional[str] = None,
    ):
        self.user_pool_id = user_pool_id
        self.client_id = client_id
        self.region = region
        if issuer:
            self.issuer = issuer
        elif AWS_ENDPOINT_URL:
            self.issuer = f"{AWS_ENDPOINT_URL.rstrip('/')}/{self.user_pool_id}"
        else:
            self.issuer = f"https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}"
        self._jwks: Optional[Dict[str, Any]] = jwks

    def get_jwks(self) -> Dict[str, Any]:
        """Fetch and cache Cognito JSON Web Key Set (JWKS)."""
        if self._jwks is None:
            url = f"{self.issuer}/.well-known/jwks.json"
            try:
                with urllib.request.urlopen(url, timeout=10) as response:
                    self._jwks = json.loads(response.read().decode("utf-8"))
            except Exception as exc:
                logger.error("Failed to retrieve Cognito JWKS from %s: %s", url, exc)
                raise RuntimeError(f"Cognito JWKS retrieval failed: {exc}")
        return self._jwks

    def authenticate_token(self, token: str, db: Session) -> Optional[User]:
        """
        Validates Cognito JWT token:
        1. Validates unverified header has kid and RS256 alg.
        2. Retrieves corresponding RSA public key from JWKS.
        3. Decodes and verifies signature, expiration, and issuer.
        4. Verifies audience (ID token) or client_id (Access token).
        5. Verifies intended token_use ('id' or 'access').
        6. Extracts identity & cognito:groups for role authorization.
        7. Returns authenticated User object or None.
        """
        try:
            # 1. Inspect unverified header
            unverified_headers = jwt.get_unverified_header(token)
            kid = unverified_headers.get("kid")
            alg = unverified_headers.get("alg")
            if not kid or alg != "RS256":
                logger.warning("Cognito token missing kid or non-RS256 algorithm: %s", alg)
                return None

            # 2. Match JWK
            jwks = self.get_jwks()
            key_data = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
            if not key_data:
                logger.warning("No matching key found in JWKS for kid: %s", kid)
                return None

            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))

            # 3. Decode unverified claims first to inspect token_use
            unverified_claims = jwt.decode(token, options={"verify_signature": False})
            token_use = unverified_claims.get("token_use")
            if token_use not in ("id", "access"):
                logger.warning("Invalid Cognito token_use claim: %s", token_use)
                return None

            # 4. Verify signature, issuer, expiry, and audience/client_id
            if token_use == "id":
                claims = jwt.decode(
                    token,
                    public_key,
                    algorithms=["RS256"],
                    audience=self.client_id,
                    issuer=self.issuer,
                    options={"verify_exp": True, "verify_iss": True, "verify_aud": True},
                )
            else:  # access token
                claims = jwt.decode(
                    token,
                    public_key,
                    algorithms=["RS256"],
                    issuer=self.issuer,
                    options={"verify_exp": True, "verify_iss": True, "verify_aud": False},
                )
                if claims.get("client_id") != self.client_id:
                    logger.warning("Access token client_id mismatch: %s != %s", claims.get("client_id"), self.client_id)
                    return None

            # 5. Extract user claims & permissions
            email = claims.get("email") or claims.get("cognito:username") or claims.get("username")
            if not email:
                sub = claims.get("sub")
                if sub:
                    email = f"{sub}@cognito.autogen"
                else:
                    return None

            # Determine role from Cognito groups
            groups: List[str] = claims.get("cognito:groups", [])
            role = "researcher"
            if any(g.lower() in ("administrators", "admin", "admins") for g in groups):
                role = "admin"
            elif any(g.lower() in ("clinicians", "clinician", "physician") for g in groups):
                role = "clinician"

            # 6. Resolve User in PostgreSQL
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = User(
                    email=email,
                    hashed_password="",  # Managed in AWS Cognito
                    full_name=claims.get("name") or claims.get("cognito:username") or email.split("@")[0],
                    role=role,
                    is_active=True,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                # Update role if groups changed in Cognito
                if user.role != role and role == "admin":
                    user.role = role
                    db.commit()
                    db.refresh(user)

            return user

        except jwt.ExpiredSignatureError:
            logger.warning("Cognito token has expired.")
            return None
        except jwt.InvalidTokenError as exc:
            logger.warning("Invalid Cognito token: %s", exc)
            return None
        except Exception as exc:
            logger.error("Unexpected error validating Cognito token: %s", exc)
            return None

