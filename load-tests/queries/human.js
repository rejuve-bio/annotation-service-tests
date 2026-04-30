const { generateNodeId } = require('../utils');

module.exports = [
    // Query 1: Simple single gene (CROCCP3)
    () => {
        const n1 = generateNodeId();
        return {
            name: "Query 1: Simple (CROCCP3)",
            payload: {
                requests: {
                    nodes: [{ node_id: n1, id: "", type: "gene", properties: { gene_name: "CROCCP3" } }],
                    predicates: []
                }
            }
        };
    },

    // Query 2: IGF1 with transcript and protein
    () => {
        const n1 = generateNodeId(), n2 = generateNodeId(), n3 = generateNodeId();
        return {
            name: "Query 2: IGF1 Medium",
            payload: {
                requests: {
                    nodes: [
                        { node_id: n1, id: "", type: "gene", properties: { gene_name: "IGF1" } },
                        { node_id: n2, id: "", type: "transcript", properties: {} },
                        { node_id: n3, id: "", type: "protein", properties: {} }
                    ],
                    predicates: [
                        { predicate_id: generateNodeId(), type: "transcribed_from", source: n2, target: n1 },
                        { predicate_id: generateNodeId(), type: "translates_to", source: n2, target: n3 }
                    ]
                }
            }
        };
    },

    // Query 3: IGF1 with pathways and TAD
    () => {
        const n1 = generateNodeId(), n2 = generateNodeId(), n3 = generateNodeId(), n4 = generateNodeId();
        return {
            name: "Query 3: IGF1 Pathways",
            payload: {
                requests: {
                    nodes: [
                        { node_id: n1, id: "", type: "gene", properties: { gene_name: "IGF1" } },
                        { node_id: n2, id: "", type: "pathway", properties: {} },
                        { node_id: n3, id: "", type: "pathway", properties: {} },
                        { node_id: n4, id: "", type: "tad", properties: {} }
                    ],
                    predicates: [
                        { predicate_id: generateNodeId(), type: "genes_pathways", source: n1, target: n2 },
                        { predicate_id: generateNodeId(), type: "child_pathway_of", source: n3, target: n2 },
                        { predicate_id: generateNodeId(), type: "in_tad_region", source: n1, target: n4 }
                    ]
                }
            }
        };
    },

    // Query 4a: Complex BRCA2
    () => {
        return {
            name: "Query 4a: BRCA2 Complex",
            payload: {
                requests: {
                    nodes: [
                        { node_id: "aZaDXDJEjFw", id: "", type: "gene", properties: { gene_name: "BRCA2" } },
                        { node_id: "aYXWRRxQBMN", id: "", type: "transcript", properties: {} },
                        { node_id: "aJCuFsXtDDG", id: "", type: "protein", properties: {} },
                        { node_id: "aUrcYASglAn", id: "", type: "pathway", properties: {} }
                    ],
                    predicates: [
                        { predicate_id: "JGjZQCeiTk", type: "transcribed to", source: "aZaDXDJEjFw", target: "aYXWRRxQBMN" },
                        { predicate_id: "ptmiucZALr", type: "translates to", source: "aYXWRRxQBMN", target: "aJCuFsXtDDG" },
                        { predicate_id: "JVETIrSdrt", type: "genes pathways", source: "aZaDXDJEjFw", target: "aUrcYASglAn" }
                    ]
                }
            }
        };
    },

    // Query 4b: IGF2 with regulatory elements
    () => {
        return {
            name: "Query 4b: IGF2 Regulatory",
            payload: {
                requests: {
                    nodes: [
                        { node_id: "n1", id: "", type: "promoter", properties: {} },
                        { node_id: "n2", id: "", type: "gene", properties: { gene_name: "IGF2" } },
                        { node_id: "n3", id: "", type: "enhancer", properties: {} },
                        { node_id: "n4", id: "", type: "pathway", properties: {} },
                        { node_id: "n5", id: "", type: "pathway", properties: {} }
                    ],
                    predicates: [
                        { predicate_id: "p1", type: "associated with", source: "n1", target: "n2" },
                        { predicate_id: "p2", type: "associated with", source: "n3", target: "n2" },
                        { predicate_id: "p3", type: "genes pathways", source: "n2", target: "n4" },
                        { predicate_id: "p4", type: "child pathway of", source: "n5", target: "n4" }
                    ]
                }
            }
        };
    },

    // Query 6: Transcript-centric (TP73-AS1)
    () => {
        return {
            name: "Query 6: TP73-AS1 Transcript",
            payload: {
                requests: {
                    nodes: [
                        { node_id: "n1", id: "", type: "transcript", properties: { gene_name: "TP73-AS1" } },
                        { node_id: "n2", id: "", type: "exon", properties: {} },
                        { node_id: "n3", id: "", type: "gene", properties: {} }
                    ],
                    predicates: [
                        { predicate_id: "p1", type: "includes", source: "n1", target: "n2" },
                        { predicate_id: "p2", type: "transcribed_from", source: "n1", target: "n3" }
                    ]
                }
            }
        };
    }
];
