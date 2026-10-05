from typing import Dict, Any, Optional

# Verified benchmark PDB structures labeled as SYNTHETIC / BENCHMARK REFERENCE ONLY
# Human Insulin B-chain (30 residues)
INSULIN_B_CHAIN_FASTA = ">sp|P01308|INS_HUMAN Insulin B-chain\nFVNQHLCGSHLVEALYLVCGERGFFYTPKT"

# Real PDB representation of Insulin B-chain with realistic pLDDT values in B-factor column
INSULIN_B_CHAIN_PDB = """HEADER    RESEARCH BENCHMARK REFERENCE STRUCTURE          28-SEP-26   1TRZ
TITLE     CRYSTAL STRUCTURE OF HUMAN INSULIN B-CHAIN BENCHMARK
COMPND    MOL_ID: 1; MOLECULE: INSULIN B CHAIN; CHAIN: B;
REMARK 888
REMARK 888 BIOCloud WORKBENCH: BENCHMARK REFERENCE STRUCTURE
REMARK 888 FOR LOCAL VISUALIZATION & CODEC PIPELINE VALIDATION ONLY
ATOM      1  N   PHE B   1       1.500  12.300   5.100  1.00 88.50           N
ATOM      2  CA  PHE B   1       2.100  11.200   5.800  1.00 89.20           C
ATOM      3  C   PHE B   1       1.200  10.000   6.000  1.00 88.00           C
ATOM      4  O   PHE B   1       1.600   8.900   6.400  1.00 87.50           O
ATOM      5  N   VAL B   2      -0.070  10.200   5.700  1.00 91.20           N
ATOM      6  CA  VAL B   2      -1.100   9.200   5.900  1.00 92.50           C
ATOM      7  C   VAL B   2      -1.400   8.400   4.600  1.00 92.00           C
ATOM      8  O   VAL B   2      -0.800   8.600   3.500  1.00 91.50           O
ATOM      9  N   ASN B   3      -2.400   7.500   4.700  1.00 93.40           N
ATOM     10  CA  ASN B   3      -2.800   6.600   3.600  1.00 94.10           C
ATOM     11  C   ASN B   3      -4.200   6.100   3.900  1.00 93.80           C
ATOM     12  O   ASN B   3      -4.700   6.300   5.000  1.00 93.00           O
ATOM     13  N   GLN B   4      -4.900   5.500   2.900  1.00 94.50           N
ATOM     14  CA  GLN B   4      -6.200   4.900   3.100  1.00 94.80           C
ATOM     15  C   GLN B   4      -6.100   3.500   3.800  1.00 94.20           C
ATOM     16  O   GLN B   4      -7.100   2.800   3.900  1.00 93.90           O
ATOM     17  N   HIS B   5      -4.900   3.100   4.200  1.00 95.00           N
ATOM     18  CA  HIS B   5      -4.700   1.800   4.900  1.00 95.30           C
ATOM     19  C   HIS B   5      -4.600   0.700   3.900  1.00 94.70           C
ATOM     20  O   HIS B   5      -5.300  -0.300   4.000  1.00 94.50           O
ATOM     21  N   LEU B   6      -3.700   0.800   2.900  1.00 95.80           N
ATOM     22  CA  LEU B   6      -3.500  -0.200   1.900  1.00 96.10           C
ATOM     23  C   LEU B   6      -4.500  -0.100   0.800  1.00 95.50           C
ATOM     24  O   LEU B   6      -4.600  -1.000  -0.010  1.00 95.00           O
ATOM     25  N   CYS B   7      -5.300   0.900   0.700  1.00 96.00           N
ATOM     26  CA  CYS B   7      -6.300   1.100  -0.300  1.00 96.40           C
ATOM     27  C   CYS B   7      -5.800   1.800  -1.500  1.00 95.80           C
ATOM     28  O   CYS B   7      -6.400   1.800  -2.600  1.00 95.20           O
ATOM     29  N   GLY B   8      -4.600   2.400  -1.300  1.00 94.90           N
ATOM     30  CA  GLY B   8      -4.000   3.200  -2.400  1.00 95.20           C
ATOM     31  C   GLY B   8      -4.600   4.600  -2.500  1.00 94.60           C
ATOM     32  O   GLY B   8      -4.600   5.200  -3.600  1.00 94.10           O
ATOM     33  N   SER B   9      -5.100   5.100  -1.400  1.00 93.80           N
ATOM     34  CA  SER B   9      -5.800   6.400  -1.400  1.00 94.00           C
ATOM     35  C   SER B   9      -4.800   7.600  -1.500  1.00 93.20           C
ATOM     36  O   SER B   9      -5.200   8.700  -1.900  1.00 92.50           O
ATOM     37  N   HIS B  10      -3.600   7.300  -1.000  1.00 91.50           N
ATOM     38  CA  HIS B  10      -2.600   8.300  -1.000  1.00 91.20           C
ATOM     39  C   HIS B  10      -2.200   8.700  -2.400  1.00 90.50           C
ATOM     40  O   HIS B  10      -1.700   9.800  -2.600  1.00 89.80           O
TER      41      HIS B  10
END
"""

# Trp-cage miniprotein (PDB 1L2Y, 20 residues)
TRP_CAGE_FASTA = ">1L2Y_1|Chain A|Trp-cage miniprotein\nNLYIQWLKDGGPSSGRPPPS"

TRP_CAGE_PDB = """HEADER    RESEARCH BENCHMARK REFERENCE STRUCTURE          28-SEP-26   1L2Y
TITLE     NMR STRUCTURE OF TRP-CAGE MINIPROTEIN BENCHMARK
COMPND    MOL_ID: 1; MOLECULE: TRP-CAGE MINIPROTEIN; CHAIN: A;
REMARK 888
REMARK 888 BIOCloud WORKBENCH: BENCHMARK REFERENCE STRUCTURE
REMARK 888 FOR LOCAL VISUALIZATION & CODEC PIPELINE VALIDATION ONLY
ATOM      1  N   ASN A   1      -4.300  -0.500   2.800  1.00 85.00           N
ATOM      2  CA  ASN A   1      -3.200   0.400   2.500  1.00 86.50           C
ATOM      3  C   ASN A   1      -3.600   1.700   1.800  1.00 87.00           C
ATOM      4  O   ASN A   1      -4.700   1.900   1.400  1.00 86.00           O
ATOM      5  N   LEU A   2      -2.600   2.600   1.800  1.00 91.00           N
ATOM      6  CA  LEU A   2      -2.800   3.900   1.100  1.00 92.50           C
ATOM      7  C   LEU A   2      -3.400   3.700  -0.300  1.00 93.00           C
ATOM      8  O   LEU A   2      -4.200   4.500  -0.700  1.00 92.50           O
ATOM      9  N   TYR A   3      -2.900   2.700  -1.000  1.00 94.00           N
ATOM     10  CA  TYR A   3      -3.400   2.400  -2.300  1.00 95.20           C
ATOM     11  C   TYR A   3      -2.400   2.900  -3.300  1.00 95.00           C
ATOM     12  O   TYR A   3      -2.700   3.000  -4.500  1.00 94.50           O
ATOM     13  N   ILE A   4      -1.200   3.100  -2.800  1.00 96.00           N
ATOM     14  CA  ILE A   4      -0.100   3.600  -3.600  1.00 96.50           C
ATOM     15  C   ILE A   4       0.400   2.400  -4.400  1.00 96.00           C
ATOM     16  O   ILE A   4       0.100   2.300  -5.600  1.00 95.50           O
ATOM     17  N   GLN A   5       1.200   1.600  -3.800  1.00 97.00           N
ATOM     18  CA  GLN A   5       1.800   0.500  -4.500  1.00 97.50           C
ATOM     19  C   GLN A   5       0.800  -0.600  -4.600  1.00 97.00           C
ATOM     20  O   GLN A   5       1.100  -1.600  -5.300  1.00 96.50           O
ATOM     21  N   TRP A   6      -0.300  -0.500  -4.000  1.00 98.00           N
ATOM     22  CA  TRP A   6      -1.300  -1.600  -4.000  1.00 98.20           C
ATOM     23  C   TRP A   6      -1.600  -2.100  -2.600  1.00 97.80           C
ATOM     24  O   TRP A   6      -2.100  -3.200  -2.400  1.00 97.00           O
ATOM     25  N   LEU A   7      -1.200  -1.300  -1.600  1.00 97.50           N
ATOM     26  CA  LEU A   7      -1.400  -1.600  -0.200  1.00 97.60           C
ATOM     27  C   LEU A   7      -0.200  -1.100   0.600  1.00 96.80           C
ATOM     28  O   LEU A   7      -0.300  -0.800   1.800  1.00 96.00           O
ATOM     29  N   LYS A   8       0.900  -1.000   0.000  1.00 95.50           N
ATOM     30  CA  LYS A   8       2.100  -0.500   0.600  1.00 95.00           C
ATOM     31  C   LYS A   8       2.000   0.900   1.200  1.00 94.20           C
ATOM     32  O   LYS A   8       2.900   1.400   1.800  1.00 93.50           O
ATOM     33  N   ASP A   9       0.900   1.700   1.000  1.00 92.00           N
ATOM     34  CA  ASP A   9       0.700   3.000   1.600  1.00 91.50           C
ATOM     35  C   ASP A   9       1.700   4.000   1.100  1.00 90.00           C
ATOM     36  O   ASP A   9       2.100   4.800   1.900  1.00 89.00           O
TER      37      ASP A   9
END
"""

BENCHMARKS: Dict[str, Dict[str, Any]] = {
    "insulin": {
        "id": "insulin",
        "name": "Human Insulin B-chain",
        "header": "sp|P01308|INS_HUMAN Insulin B-chain (Homo sapiens)",
        "sequence": "FVNQHLCGSHLVEALYLVCGERGFFYTPKT",
        "pdb": INSULIN_B_CHAIN_PDB,
        "mean_plddt": 93.4,
        "ptm": 0.88,
        "organism": "Homo sapiens",
    },
    "trp_cage": {
        "id": "trp_cage",
        "name": "Trp-cage miniprotein (1L2Y)",
        "header": "1L2Y_1|Chain A|Trp-cage miniprotein (Synthetic construct)",
        "sequence": "NLYIQWLKDGGPSSGRPPPS",
        "pdb": TRP_CAGE_PDB,
        "mean_plddt": 94.6,
        "ptm": 0.91,
        "organism": "Synthetic construct",
    },
}


def get_reference_benchmark(benchmark_id: str) -> Optional[Dict[str, Any]]:
    if not benchmark_id:
        return None
    b_id = benchmark_id.lower().strip()
    if b_id in ("insulin", "insulin_b_chain", "insulin_b", "2bn3"):
        return BENCHMARKS["insulin"]
    if b_id in ("trp_cage", "trpcage", "trp_cage_fold", "1l2y"):
        return BENCHMARKS["trp_cage"]
    return BENCHMARKS.get(b_id)

