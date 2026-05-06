const { generateNodeId } = require('../utils');

module.exports = [
    // Fly Q1: Simple gene lookup — "w" (white, FBGN0003996)
    () => {
        return {
            name: "Fly Q1: Simple gene (w)",
            payload: {
                requests: {
                    nodes: [{ node_id: generateNodeId(), id: "", type: "gene", properties: { gene_name: "w" } }],
                    predicates: [],
                    source: ["all"],
                    species: "fly"
                }
            }
        };
    },

    // Fly Q2: Gene → Transcript → Protein — "dpp" (decapentaplegic, FBGN0000490)
    () => {
        const n1 = generateNodeId(), n2 = generateNodeId(), n3 = generateNodeId();
        return {
            name: "Fly Q2: dpp gene chain",
            payload: {
                requests: {
                    nodes: [
                        { node_id: n1, id: "", type: "gene",       properties: { gene_name: "dpp" } },
                        { node_id: n2, id: "", type: "transcript",  properties: {} },
                        { node_id: n3, id: "", type: "protein",     properties: {} }
                    ],
                    predicates: [
                        { predicate_id: generateNodeId(), type: "transcribes_to", source: n1, target: n2 },
                        { predicate_id: generateNodeId(), type: "translates_to",  source: n2, target: n3 }
                    ],
                    source: ["all"],
                    species: "fly"
                }
            }
        };
    },

    // Fly Q3: Protein lookup by confirmed UniProt ID — mirrors user's working Postman query
    () => {
        const n1 = generateNodeId(), n2 = generateNodeId(), n3 = generateNodeId();
        return {
            name: "Fly Q3: Protein P92177 lineage",
            payload: {
                requests: {
                    nodes: [
                        { node_id: n1, id: "",       type: "gene",       properties: {} },
                        { node_id: n2, id: "",       type: "transcript",  properties: {} },
                        { node_id: n3, id: "P92177", type: "protein",     properties: {} }
                    ],
                    predicates: [
                        { predicate_id: generateNodeId(), type: "transcribes_to", source: n1, target: n2 },
                        { predicate_id: generateNodeId(), type: "translates_to",  source: n2, target: n3 }
                    ],
                    source: ["all"],
                    species: "fly"
                }
            }
        };
    },

    // Fly Q4: Gene → Pathway — "wg" (wingless/Wnt signaling, FBGN0284084)
    // NOTE: "participates_in" is inferred from FlyBase MeTTa data — verify in Postman before load run
    () => {
        const n1 = generateNodeId(), n2 = generateNodeId();
        return {
            name: "Fly Q4: wg pathway",
            payload: {
                requests: {
                    nodes: [
                        { node_id: n1, id: "", type: "gene",    properties: { gene_name: "wg" } },
                        { node_id: n2, id: "", type: "pathway",  properties: {} }
                    ],
                    predicates: [
                        { predicate_id: generateNodeId(), type: "participates_in", source: n1, target: n2 }
                    ],
                    source: ["all"],
                    species: "fly"
                }
            }
        };
    },

    // Fly Q5: Full chain Gene → Transcript → Protein → Pathway — "arm" (armadillo, FBGN0000117)
    // NOTE: "participates_in" needs verification
    () => {
        const n1 = generateNodeId(), n2 = generateNodeId(), n3 = generateNodeId(), n4 = generateNodeId();
        return {
            name: "Fly Q5: arm full chain",
            payload: {
                requests: {
                    nodes: [
                        { node_id: n1, id: "", type: "gene",       properties: { gene_name: "arm" } },
                        { node_id: n2, id: "", type: "transcript",  properties: {} },
                        { node_id: n3, id: "", type: "protein",     properties: {} },
                        { node_id: n4, id: "", type: "pathway",     properties: {} }
                    ],
                    predicates: [
                        { predicate_id: generateNodeId(), type: "transcribes_to",  source: n1, target: n2 },
                        { predicate_id: generateNodeId(), type: "translates_to",   source: n2, target: n3 },
                        { predicate_id: generateNodeId(), type: "participates_in", source: n3, target: n4 }
                    ],
                    source: ["all"],
                    species: "fly"
                }
            }
        };
    },

    // Fly Q6: Gene → Transcript → Exon — "p53" (FBGN0039044)
    // NOTE: "includes" (transcript→exon) needs verification
    () => {
        const n1 = generateNodeId(), n2 = generateNodeId(), n3 = generateNodeId();
        return {
            name: "Fly Q6: p53 transcript/exon",
            payload: {
                requests: {
                    nodes: [
                        { node_id: n1, id: "", type: "gene",       properties: { gene_name: "p53" } },
                        { node_id: n2, id: "", type: "transcript",  properties: {} },
                        { node_id: n3, id: "", type: "exon",        properties: {} }
                    ],
                    predicates: [
                        { predicate_id: generateNodeId(), type: "transcribes_to", source: n1, target: n2 },
                        { predicate_id: generateNodeId(), type: "includes",       source: n2, target: n3 }
                    ],
                    source: ["all"],
                    species: "fly"
                }
            }
        };
    }
];
