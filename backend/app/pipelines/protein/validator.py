import re
from typing import Tuple, Dict, Any, Optional
from backend.app.config import (
    PROTEIN_MIN_SEQUENCE_LENGTH,
    PROTEIN_MAX_SEQUENCE_LENGTH,
    PROTEIN_MAX_FILE_SIZE_MB,
)

# Standard 20 amino acid alphabet
STANDARD_AMINO_ACIDS = set("ACDEFGHIKLMNPQRSTVWY")

# Average residue molecular weight (Da)
AA_WEIGHTS = {
    "A": 71.08, "C": 103.14, "D": 115.09, "E": 129.12, "F": 147.18,
    "G": 57.05, "H": 137.14, "I": 113.16, "K": 128.17, "L": 113.16,
    "M": 131.20, "N": 114.10, "P": 97.12, "Q": 128.13, "R": 156.19,
    "S": 87.08, "T": 101.11, "V": 99.13, "W": 186.21, "Y": 163.18,
}


class ProteinValidationError(ValueError):
    pass


def parse_and_validate_fasta(fasta_input: str) -> Tuple[str, str, Dict[str, Any]]:
    """
    Parses FASTA string (from text or file) and validates:
    - Header presence (or generates standard header)
    - Valid IUPAC amino acid characters
    - Sequence length constraints
    Returns (cleaned_sequence, header, metadata_dict)
    """
    if not fasta_input or not fasta_input.strip():
        raise ProteinValidationError("Protein sequence input is empty.")

    if len(fasta_input.encode("utf-8")) > PROTEIN_MAX_FILE_SIZE_MB * 1024 * 1024:
        raise ProteinValidationError(f"Input exceeds maximum allowed size of {PROTEIN_MAX_FILE_SIZE_MB} MB.")

    lines = [line.strip() for line in fasta_input.strip().splitlines() if line.strip()]
    if not lines:
        raise ProteinValidationError("No sequence data found.")

    header = "target_protein"
    seq_lines = []

    for line in lines:
        if line.startswith(">"):
            header = line[1:].strip() or "target_protein"
        else:
            # Strip whitespace and numbers (e.g. from NCBI text copies)
            cleaned_line = re.sub(r"[\s\d]", "", line).upper()
            seq_lines.append(cleaned_line)

    sequence = "".join(seq_lines)

    if not sequence:
        raise ProteinValidationError("No amino acid sequence found in input.")

    # Validate characters
    invalid_chars = set(sequence) - STANDARD_AMINO_ACIDS
    if invalid_chars:
        invalid_list = sorted(list(invalid_chars))
        raise ProteinValidationError(
            f"Invalid amino acid character(s) detected: {', '.join(invalid_list)}. "
            f"Only standard 20 IUPAC amino acid symbols (A, C, D, E, F, G, H, I, K, L, M, N, P, Q, R, S, T, V, W, Y) are supported."
        )

    # Validate length
    seq_len = len(sequence)
    if seq_len < PROTEIN_MIN_SEQUENCE_LENGTH:
        raise ProteinValidationError(
            f"Sequence length ({seq_len} aa) is below minimum required length ({PROTEIN_MIN_SEQUENCE_LENGTH} aa). "
            "Very short peptides do not fold into stable tertiary structures."
        )

    if seq_len > PROTEIN_MAX_SEQUENCE_LENGTH:
        raise ProteinValidationError(
            f"Sequence length ({seq_len} aa) exceeds maximum single-chain prediction limit ({PROTEIN_MAX_SEQUENCE_LENGTH} aa). "
            "Please submit a specific domain or run via distributed AWS Batch cluster."
        )

    # Compute composition & molecular weight
    composition = {}
    total_mw = 18.015  # terminal water molecule (H2O)
    for aa in sequence:
        composition[aa] = composition.get(aa, 0) + 1
        total_mw += AA_WEIGHTS.get(aa, 110.0)

    metadata = {
        "sequence_length": seq_len,
        "molecular_weight_kda": round(total_mw / 1000.0, 2),
        "composition": composition,
        "header": header,
    }

    return sequence, header, metadata


def validate_and_clean_sequence(seq: str) -> str:
    cleaned = re.sub(r"[\s\d>]", "", seq).upper()
    invalid_chars = set(cleaned) - STANDARD_AMINO_ACIDS
    if invalid_chars:
        raise ProteinValidationError(f"Invalid amino acid characters: {', '.join(sorted(invalid_chars))}")
    return cleaned


def calculate_sequence_properties(sequence: str) -> Dict[str, Any]:
    total_mw = 18.015
    composition = {}
    for aa in sequence:
        composition[aa] = composition.get(aa, 0) + 1
        total_mw += AA_WEIGHTS.get(aa, 110.0)
    return {
        "sequence_length": len(sequence),
        "molecular_weight_kda": round(total_mw / 1000.0, 2),
        "composition": composition,
    }

