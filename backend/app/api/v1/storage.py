from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import Response, StreamingResponse
import io
from backend.app.adapters.storage.local import LocalStorageAdapter
from backend.app.adapters.storage import get_storage_adapter

router = APIRouter(prefix="/storage", tags=["Storage"])


@router.put("/upload")
async def local_storage_upload(request: Request, token: str = Query(...)):
    storage_key = LocalStorageAdapter.verify_token(token, "upload")
    if not storage_key:
        raise HTTPException(status_code=403, detail="Invalid, expired, or forged upload token.")

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty upload body.")

    adapter = get_storage_adapter()
    adapter.put_object(storage_key, body)

    return {"status": "success", "storage_key": storage_key, "bytes_received": len(body)}


@router.get("/download")
def local_storage_download(token: str = Query(...)):
    storage_key = LocalStorageAdapter.verify_token(token, "download")
    if not storage_key:
        raise HTTPException(status_code=403, detail="Invalid, expired, or forged download token.")

    adapter = get_storage_adapter()
    try:
        data = adapter.get_object(storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File object not found.")

    filename = storage_key.split("/")[-1]
    content_type = "application/octet-stream"
    if filename.endswith(".pdb"):
        content_type = "chemical/x-pdb"
    elif filename.endswith(".csv"):
        content_type = "text/csv"
    elif filename.endswith(".fasta") or filename.endswith(".fa"):
        content_type = "text/plain"

    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
