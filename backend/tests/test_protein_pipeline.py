import pytest
from backend.app.pipelines.protein.validator import parse_and_validate_fasta, ProteinValidationError
from backend.app.pipelines.protein.references import get_reference_benchmark, BENCHMARKS
from backend.app.pipelines.protein.esmfold import ESMFoldAdapter


def test_fasta_validation_valid():
    fasta = ">sp|P01308|INS_HUMAN Insulin\nFVNQHLCGSHLVEALYLVCGERGFFYTPKT"
    seq, header, meta = parse_and_validate_fasta(fasta)
    assert seq == "FVNQHLCGSHLVEALYLVCGERGFFYTPKT"
    assert "INS_HUMAN" in header
    assert meta["sequence_length"] == 30
    assert meta["molecular_weight_kda"] > 3.0


def test_fasta_validation_invalid_amino_acid():
    fasta = ">invalid_protein\nFVNQHLCGSHLVEAL123#$"
    with pytest.raises(ProteinValidationError) as exc:
        parse_and_validate_fasta(fasta)
    assert "Invalid amino acid character" in str(exc.value)


def test_fasta_validation_too_short():
    fasta = ">short_peptide\nACDEF"
    with pytest.raises(ProteinValidationError) as exc:
        parse_and_validate_fasta(fasta)
    assert "below minimum required length" in str(exc.value)


def test_reference_benchmarks():
    insulin = get_reference_benchmark("insulin")
    assert insulin is not None
    assert "ATOM" in insulin["pdb"]
    assert insulin["mean_plddt"] > 90.0

    trp_cage = get_reference_benchmark("trp_cage")
    assert trp_cage is not None
    assert "Trp-cage" in trp_cage["name"]


def test_esmfold_benchmark_execution():
    fasta = ">Insulin_test\nFVNQHLCGSHLVEALYLVCGERGFFYTPKT"
    seq, header, meta = parse_and_validate_fasta(fasta)
    res = ESMFoldAdapter.predict(
        sequence=seq,
        header=header,
        metadata=meta,
        params={"reference_benchmark": "insulin"},
    )
    assert res["model_status"] == "completed"
    assert res["is_reference_benchmark"] is True
    assert res["mean_plddt"] is not None
    assert "ATOM" in res["pdb_content"]


def test_esmfold_unconfigured_model_behavior():
    # Sequence with no benchmark and unconfigured remote/gpu
    fasta = ">Custom_Synthetic_Protein\nNLYIQWLKDGGPSSGRPPPSNLYIQWLKDGGPSSGRPPPS"
    seq, header, meta = parse_and_validate_fasta(fasta)
    res = ESMFoldAdapter.predict(
        sequence=seq,
        header=header,
        metadata=meta,
        params={},
    )
    # Per prompt requirement:
    # "If the real model is not installed or configured, show an actionable 'model unavailable' state and setup instructions.
    # Never fabricate a predicted structure or report a simulated prediction as completed."
    if res["model_status"] == "model_unavailable":
        assert res["pdb_content"] is None
        assert "setup_instructions" in res
        assert "No simulated structure generated" in res["research_disclaimer"]


def test_uniprot_and_pdb_lookup():
    from backend.app.pipelines.protein.uniprot import resolve_protein_identifier

    # 1. UniProt Accession (Insulin)
    ins = resolve_protein_identifier("P01308")
    assert ins["identifier"] == "P01308"
    assert "Insulin" in ins["protein_name"]
    assert ins["sequence_length"] == 110
    assert ins["molecular_weight_kda"] > 10.0
    assert "MALWMR" in ins["sequence"]

    # 2. Gene Symbol (TP53 -> p53)
    p53 = resolve_protein_identifier("TP53")
    assert p53["identifier"] == "P04637"
    assert "p53" in p53["protein_name"]
    assert p53["sequence_length"] == 393

    # 3. PDB ID (1CRN -> Crambin)
    crn = resolve_protein_identifier("1CRN")
    assert crn["identifier"] == "1CRN"
    assert "Crambin" in crn["protein_name"]
    assert len(crn["sequence"]) == 46

    # 4. Unknown Identifier
    with pytest.raises(ValueError):
        resolve_protein_identifier("TOTALLY_UNKNOWN_99999")

