import re
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List
from backend.app.pipelines.protein.validator import validate_and_clean_sequence, calculate_sequence_properties


# Standard offline verified repository for instant offline research and benchmark comparison
BUILTIN_PROTEIN_KNOWLEDGEBASE: Dict[str, Dict[str, Any]] = {
    "P01308": {
        "identifier": "P01308",
        "source": "UniProtKB",
        "entry_name": "INS_HUMAN",
        "protein_name": "Insulin Precursor",
        "gene_name": "INS",
        "organism": "Homo sapiens (Human)",
        "taxonomy_id": "9606",
        "sequence": "MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN",
        "function_summary": "Insulin decreases blood glucose concentration. It increases cell permeability to monosaccharides, amino acids and fatty acids and accelerates glycolysis, the pentose phosphate cycle, and glycogen synthesis.",
        "pdb_ids": ["1BEN", "1MSO", "4INS", "3I40"],
        "subcellular_location": "Secreted",
    },
    "P04637": {
        "identifier": "P04637",
        "source": "UniProtKB",
        "entry_name": "P53_HUMAN",
        "protein_name": "Cellular Tumor Antigen p53 (Guardian of the Genome)",
        "gene_name": "TP53",
        "organism": "Homo sapiens (Human)",
        "taxonomy_id": "9606",
        "sequence": "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPDEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTTIHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEEENLRKKGEPHHELPPGSTKRALPNNTSSSPQPKKKPLDGEYFTLQIRGRERFEMFRELNEALELKDAQAGKEPGGSRAHSSHLKSKKGQSTSRHKKLMFKTEGPDSD",
        "function_summary": "Acts as a tumor suppressor in many tumor types; induces growth arrest or apoptosis depending on the physiological circumstances and type of cell. Involved in cell cycle regulation as a trans-activator.",
        "pdb_ids": ["1TUP", "1TSR", "2AC0", "3KMD"],
        "subcellular_location": "Cytoplasm, Nucleus, Mitochondrion",
    },
    "P68871": {
        "identifier": "P68871",
        "source": "UniProtKB",
        "entry_name": "HBB_HUMAN",
        "protein_name": "Hemoglobin Subunit Beta",
        "gene_name": "HBB",
        "organism": "Homo sapiens (Human)",
        "taxonomy_id": "9606",
        "sequence": "MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH",
        "function_summary": "Involved in oxygen transport from the lung to the various peripheral tissues. Forms a heterotetramer of two alpha and two beta subunits with four heme prosthetic groups.",
        "pdb_ids": ["1HHO", "2DN2", "4HHB", "1A3N"],
        "subcellular_location": "Red blood cell cytoplasm",
    },
    "P01116": {
        "identifier": "P01116",
        "source": "UniProtKB",
        "entry_name": "RASH_HUMAN",
        "protein_name": "GTPase KRas",
        "gene_name": "KRAS",
        "organism": "Homo sapiens (Human)",
        "taxonomy_id": "9606",
        "sequence": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQRVEDAFYTLVREIRQYRLKKISKEEKTPGCVKIKKCIIM",
        "function_summary": "Ras proteins bind GDP/GTP and possess intrinsic GTPase activity. Plays an important role in the regulation of cell proliferation and is frequently mutated in human pancreatic and colorectal adenocarcinomas.",
        "pdb_ids": ["4OBE", "6OIM", "7LGI", "8AZV"],
        "subcellular_location": "Cell membrane",
    },
    "1CRN": {
        "identifier": "1CRN",
        "source": "RCSB PDB",
        "entry_name": "CRAM_CRAAB",
        "protein_name": "Crambin (Hydrophobic Seed Protein)",
        "gene_name": "CRN",
        "organism": "Crambe hispanica subsp. abyssinica",
        "taxonomy_id": "3721",
        "sequence": "TTCCPSIVARSNFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN",
        "function_summary": "High-resolution reference benchmark model in protein crystallography (0.54 Angstrom resolution). Extremely stable plant seed storage protein with three conserved disulfide bridges.",
        "pdb_ids": ["1CRN", "1EJG"],
        "subcellular_location": "Plant seed endosperm",
    },
    "1UBQ": {
        "identifier": "1UBQ",
        "source": "RCSB PDB",
        "entry_name": "UBIQ_HUMAN",
        "protein_name": "Ubiquitin",
        "gene_name": "UBB",
        "organism": "Homo sapiens (Human)",
        "taxonomy_id": "9606",
        "sequence": "MQIFVKTLTGKTITLEVEPSDTIENVKAKIQDKEGIPPDQQRLIFAGKQLEDGRTLSDYNIQKESTLHLVLRLRGG",
        "function_summary": "Ubiquitin is a 76-amino acid polypeptide that plays a major regulatory role in eukaryotic cell physiology through targeted post-translational proteasomal degradation.",
        "pdb_ids": ["1UBQ", "1D3Z"],
        "subcellular_location": "Cytoplasm, Nucleus",
    },
}

# Alias mapping
ALIAS_LOOKUP = {
    "INS": "P01308",
    "INSULIN": "P01308",
    "INS_HUMAN": "P01308",
    "P53": "P04637",
    "TP53": "P04637",
    "P53_HUMAN": "P04637",
    "HBB": "P68871",
    "HEMOGLOBIN": "P68871",
    "HBB_HUMAN": "P68871",
    "KRAS": "P01116",
    "KRAS_HUMAN": "P01116",
    "CRAMBIN": "1CRN",
    "UBIQUITIN": "1UBQ",
    "UBQ": "1UBQ",
}


def fetch_from_uniprot_api(accession: str, timeout: int = 5) -> Optional[Dict[str, Any]]:
    """Fetch live protein record from UniProt REST API."""
    url = f"https://rest.uniprot.org/uniprotkb/{accession}.json"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "BioCloudWorkbench/1.0 (Research Pipeline; contact@biocloud.local)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                primary_acc = data.get("primaryAccession", accession)
                entry_name = data.get("uniProtkbId", "")
                
                # Protein description
                protein_desc = data.get("proteinDescription", {})
                rec_name = protein_desc.get("recommendedName", {}).get("fullName", {}).get("value", "")
                
                # Gene name
                genes = data.get("genes", [])
                gene_name = genes[0].get("geneName", {}).get("value", "") if genes else ""
                
                # Organism
                organism_info = data.get("organism", {})
                organism_name = organism_info.get("scientificName", "")
                common_name = organism_info.get("commonName", "")
                org_str = f"{organism_name} ({common_name})" if common_name else organism_name
                taxon_id = str(organism_info.get("taxonId", ""))
                
                # Sequence
                seq_obj = data.get("sequence", {})
                sequence = seq_obj.get("value", "")
                
                # Comments/Function
                function_summary = ""
                comments = data.get("comments", [])
                for c in comments:
                    if c.get("commentType") == "FUNCTION":
                        texts = c.get("texts", [])
                        if texts:
                            function_summary = texts[0].get("value", "")
                            break
                            
                # PDB cross-references
                pdb_ids = []
                xrefs = data.get("uniProtKBCrossReferences", [])
                for xr in xrefs:
                    if xr.get("database") == "PDB":
                        pdb_ids.append(xr.get("id"))
                        if len(pdb_ids) >= 6:
                            break
                            
                return {
                    "identifier": primary_acc,
                    "source": "UniProtKB (Live)",
                    "entry_name": entry_name,
                    "protein_name": rec_name or primary_acc,
                    "gene_name": gene_name,
                    "organism": org_str or "Unknown Organism",
                    "taxonomy_id": taxon_id,
                    "sequence": sequence,
                    "function_summary": function_summary or "Documented UniProt target sequence.",
                    "pdb_ids": pdb_ids,
                    "subcellular_location": "Cellular",
                }
    except Exception:
        return None
    return None


def fetch_from_pdb_api(pdb_id: str, timeout: int = 5) -> Optional[Dict[str, Any]]:
    """Fetch live structure metadata and sequence from RCSB PDB REST API."""
    pdb_clean = pdb_id.lower().strip()
    url = f"https://data.rcsb.org/rest/v1/core/entry/{pdb_clean}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "BioCloudWorkbench/1.0 (Research Pipeline)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                struct = data.get("struct", {})
                title = struct.get("title", f"PDB Structure {pdb_id.upper()}")
                
                # Fetch FASTA from RCSB
                fasta_url = f"https://www.rcsb.org/fasta/entry/{pdb_clean}"
                fasta_req = urllib.request.Request(fasta_url)
                with urllib.request.urlopen(fasta_req, timeout=timeout) as f_resp:
                    fasta_text = f_resp.read().decode("utf-8")
                    lines = fasta_text.strip().splitlines()
                    seq_lines = [l.strip() for l in lines if not l.startswith(">")]
                    sequence = "".join(seq_lines)
                    
                return {
                    "identifier": pdb_id.upper(),
                    "source": "RCSB PDB (Live)",
                    "entry_name": pdb_id.upper(),
                    "protein_name": title,
                    "gene_name": "PDB_CHAIN",
                    "organism": "Experimentally Determined Structure",
                    "taxonomy_id": "N/A",
                    "sequence": sequence,
                    "function_summary": f"Macromolecular crystal structure deposited in Protein Data Bank: {title}",
                    "pdb_ids": [pdb_id.upper()],
                    "subcellular_location": "Biomacromolecule",
                }
    except Exception:
        return None
    return None


def resolve_protein_identifier(query: str) -> Dict[str, Any]:
    """
    Resolves UniProt accession, gene name, or PDB ID into a complete,
    IUPAC-validated sequence record with structural metadata.
    Prioritizes instantaneous local knowledgebase with graceful live REST fallback.
    """
    clean_q = query.strip().upper().replace(" ", "")
    resolved_id = ALIAS_LOOKUP.get(clean_q, clean_q)
    
    # 1. Check local knowledgebase
    if resolved_id in BUILTIN_PROTEIN_KNOWLEDGEBASE:
        record = BUILTIN_PROTEIN_KNOWLEDGEBASE[resolved_id].copy()
    else:
        # Check case-insensitive
        record = None
        for k, v in BUILTIN_PROTEIN_KNOWLEDGEBASE.items():
            if k.upper() == resolved_id or v.get("gene_name", "").upper() == resolved_id:
                record = v.copy()
                break
                
        # 2. Try live UniProt REST API if 6-10 character accession pattern
        if not record and re.match(r"^[A-NR-Z][0-9][A-Z][A-Z0-9]{2}[0-9]$", resolved_id, re.IGNORECASE):
            record = fetch_from_uniprot_api(resolved_id)
            
        # 3. Try live RCSB PDB if 4 character pattern
        if not record and re.match(r"^[0-9][A-Za-z0-9]{3}$", resolved_id):
            record = fetch_from_pdb_api(resolved_id)
            
        if not record:
            # Default fallback to Insulin
            raise ValueError(
                f"Protein identifier '{query}' not found. Supported entries include UniProt accessions "
                f"(e.g. P01308, P04637, P68871, P01116), PDB IDs (e.g. 1CRN, 1UBQ), or gene symbols (INS, TP53, HBB, KRAS)."
            )

    # Clean and validate sequence
    clean_seq = validate_and_clean_sequence(record["sequence"])
    props = calculate_sequence_properties(clean_seq)
    
    fasta_header = f">sp|{record['identifier']}|{record['entry_name']} {record['protein_name']} OS={record['organism']} GN={record.get('gene_name', 'N/A')}"
    
    return {
        "identifier": record["identifier"],
        "source": record.get("source", "UniProtKB"),
        "entry_name": record.get("entry_name", record["identifier"]),
        "protein_name": record["protein_name"],
        "gene_name": record.get("gene_name", "N/A"),
        "organism": record["organism"],
        "taxonomy_id": record.get("taxonomy_id", "9606"),
        "sequence": clean_seq,
        "sequence_length": len(clean_seq),
        "molecular_weight_kda": props["molecular_weight_kda"],
        "isoelectric_point_pi": props.get("isoelectric_point_pi", 6.8),
        "fasta_header": fasta_header,
        "fasta_formatted": f"{fasta_header}\n{clean_seq}",
        "function_summary": record.get("function_summary", ""),
        "subcellular_location": record.get("subcellular_location", "Cellular"),
        "pdb_ids": record.get("pdb_ids", []),
        "alphafold_db_url": f"https://alphafold.ebi.ac.uk/entry/{record['identifier']}",
        "research_disclaimer": "Research Use Only. Not for clinical diagnostic use.",
    }
