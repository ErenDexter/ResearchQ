/**
 * Seed built-in literature review methodologies with phases and expected outputs.
 */

import { db } from '.';
import { reviewMethodologies, methodologyPhases } from './schema';
import { sql } from 'drizzle-orm';

interface MethodologySeed {
	name: string;
	description: string;
	type: string;
	domain: string;
	phases: {
		name: string;
		description: string;
		expectedOutputs: string[];
	}[];
}

const METHODOLOGIES: MethodologySeed[] = [
	// ── Systematic Reviews ──────────────────────────────────────────
	{
		name: 'PRISMA',
		description:
			'Preferred Reporting Items for Systematic Reviews and Meta-Analyses. The most widely used guideline for conducting and reporting systematic reviews, providing a 27-item checklist and a four-phase flow diagram.',
		type: 'systematic',
		domain: 'general',
		phases: [
			{
				name: 'Protocol Development',
				description: 'Define research questions, eligibility criteria, search strategy, and analysis plan. Register the protocol if possible.',
				expectedOutputs: ['protocol_document', 'search_strategy_log']
			},
			{
				name: 'Identification',
				description: 'Search databases (ACM, IEEE, Springer, Elsevier, etc.), registers, and other sources. Record the number of records identified from each source.',
				expectedOutputs: ['search_strategy_log', 'bibliometric_analysis']
			},
			{
				name: 'Screening',
				description: 'Screen titles and abstracts against eligibility criteria. Remove duplicates. Record reasons for exclusion.',
				expectedOutputs: ['prisma_flow_diagram', 'inclusion_exclusion_table']
			},
			{
				name: 'Eligibility',
				description: 'Retrieve and assess full-text articles for eligibility. Record exclusion reasons for each full-text article excluded.',
				expectedOutputs: ['inclusion_exclusion_table', 'prisma_flow_diagram']
			},
			{
				name: 'Quality Assessment',
				description: 'Assess the risk of bias and methodological quality of each included study using appropriate tools.',
				expectedOutputs: ['risk_of_bias_table', 'quality_appraisal_table', 'study_characteristics_table']
			},
			{
				name: 'Data Extraction',
				description: 'Extract relevant data from each included study into a structured matrix.',
				expectedOutputs: ['data_extraction_matrix', 'coding_framework']
			},
			{
				name: 'Synthesis',
				description: 'Synthesize findings narratively and/or quantitatively. Assess certainty of evidence.',
				expectedOutputs: ['narrative_summary', 'thematic_synthesis', 'forest_plot_data', 'funnel_plot_data', 'grade_evidence_table']
			},
			{
				name: 'Reporting',
				description: 'Compile the final review report following the PRISMA checklist. Generate flow diagram with final counts.',
				expectedOutputs: ['prisma_flow_diagram', 'summary_of_findings', 'gap_map', 'annotated_bibliography']
			}
		]
	},
	{
		name: 'PRISMA-ScR',
		description:
			'PRISMA Extension for Scoping Reviews. Adapted from PRISMA for scoping reviews that map the existing literature on a topic rather than answer a specific clinical question.',
		type: 'scoping',
		domain: 'general',
		phases: [
			{
				name: 'Protocol Development',
				description: 'Define the research question using PCC (Population, Concept, Context) framework. Outline inclusion criteria and search strategy.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Identification',
				description: 'Conduct comprehensive searches across relevant databases and grey literature sources.',
				expectedOutputs: ['search_strategy_log', 'bibliometric_analysis']
			},
			{
				name: 'Screening',
				description: 'Screen titles/abstracts, then full texts against inclusion criteria.',
				expectedOutputs: ['prisma_flow_diagram', 'inclusion_exclusion_table']
			},
			{
				name: 'Charting the Data',
				description: 'Extract and chart key information from included sources using a data charting form.',
				expectedOutputs: ['data_extraction_matrix', 'systematic_map_table']
			},
			{
				name: 'Collating & Summarizing',
				description: 'Summarize and report results. Identify gaps and implications for future research.',
				expectedOutputs: ['narrative_summary', 'gap_map', 'thematic_synthesis']
			}
		]
	},
	{
		name: 'Cochrane Framework',
		description:
			'The gold standard for systematic reviews in healthcare. Provides rigorous methodology for identifying, appraising, and synthesizing research evidence to inform clinical decisions.',
		type: 'systematic',
		domain: 'health',
		phases: [
			{
				name: 'Define the Question',
				description: 'Formulate a clear, answerable review question using PICO format.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Develop Protocol',
				description: 'Write a detailed protocol specifying objectives, methods, and criteria. Register on PROSPERO.',
				expectedOutputs: ['protocol_document', 'search_strategy_log']
			},
			{
				name: 'Search for Studies',
				description: 'Conduct comprehensive, reproducible searches across multiple databases (MEDLINE, CENTRAL, Embase, etc.).',
				expectedOutputs: ['search_strategy_log']
			},
			{
				name: 'Select Studies',
				description: 'Apply inclusion/exclusion criteria. Two reviewers independently screen titles, abstracts, and full texts.',
				expectedOutputs: ['prisma_flow_diagram', 'inclusion_exclusion_table']
			},
			{
				name: 'Assess Risk of Bias',
				description: 'Use the Cochrane Risk of Bias tool (RoB 2) to assess each included study across bias domains.',
				expectedOutputs: ['risk_of_bias_table', 'study_characteristics_table']
			},
			{
				name: 'Extract Data',
				description: 'Extract data systematically using pre-defined forms. Verify extraction accuracy.',
				expectedOutputs: ['data_extraction_matrix']
			},
			{
				name: 'Analyse & Synthesize',
				description: 'Perform meta-analysis where appropriate. Assess heterogeneity. Use GRADE to rate certainty of evidence.',
				expectedOutputs: ['forest_plot_data', 'funnel_plot_data', 'narrative_summary', 'grade_evidence_table']
			},
			{
				name: 'Report & Interpret',
				description: 'Write the review following Cochrane reporting standards. Present summary of findings table.',
				expectedOutputs: ['summary_of_findings', 'prisma_flow_diagram', 'annotated_bibliography']
			}
		]
	},
	{
		name: 'Kitchenham SLR Guidelines',
		description:
			'Barbara Kitchenham\'s guidelines for performing systematic literature reviews in software engineering. The most cited SLR methodology in the SE community.',
		type: 'systematic',
		domain: 'software_engineering',
		phases: [
			{
				name: 'Planning',
				description: 'Identify the need for a review. Define research questions, search strategy, selection criteria, quality assessment criteria, and data extraction strategy.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Search',
				description: 'Search digital libraries (ACM DL, IEEE Xplore, Springer, ScienceDirect, Wiley Online). Perform snowball sampling from reference lists.',
				expectedOutputs: ['search_strategy_log', 'bibliometric_analysis']
			},
			{
				name: 'Selection',
				description: 'Apply inclusion/exclusion criteria to search results. Resolve disagreements between reviewers.',
				expectedOutputs: ['inclusion_exclusion_table', 'prisma_flow_diagram']
			},
			{
				name: 'Quality Assessment',
				description: 'Evaluate each study against quality criteria. Score studies and decide on inclusion threshold.',
				expectedOutputs: ['quality_appraisal_table', 'study_characteristics_table']
			},
			{
				name: 'Data Extraction',
				description: 'Design data extraction forms. Extract data from each included study. Pilot test the extraction process.',
				expectedOutputs: ['data_extraction_matrix', 'systematic_map_table']
			},
			{
				name: 'Data Synthesis',
				description: 'Synthesize extracted data using narrative synthesis, meta-analysis, or both. Identify patterns and trends.',
				expectedOutputs: ['narrative_summary', 'gap_map', 'bibliometric_analysis', 'thematic_synthesis']
			},
			{
				name: 'Reporting',
				description: 'Write the systematic review report. Include all details needed for replication.',
				expectedOutputs: ['annotated_bibliography', 'summary_of_findings']
			}
		]
	},
	// ── Scoping Reviews ─────────────────────────────────────────────
	{
		name: 'Arksey & O\'Malley Framework',
		description:
			'The foundational scoping review framework (2005). Five-stage methodology for mapping a broad topic area to identify key concepts, gaps, and types of evidence.',
		type: 'scoping',
		domain: 'social_sciences',
		phases: [
			{
				name: 'Identify the Research Question',
				description: 'Define a broad research question. Consider population, concept, and context.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Identify Relevant Studies',
				description: 'Develop a comprehensive search strategy. Search multiple sources including grey literature.',
				expectedOutputs: ['search_strategy_log']
			},
			{
				name: 'Study Selection',
				description: 'Iteratively refine selection criteria. Screen studies for relevance.',
				expectedOutputs: ['inclusion_exclusion_table', 'prisma_flow_diagram']
			},
			{
				name: 'Chart the Data',
				description: 'Extract and sort data according to key themes and issues. Use a charting form.',
				expectedOutputs: ['data_extraction_matrix', 'systematic_map_table']
			},
			{
				name: 'Collate, Summarize & Report',
				description: 'Present an overview of all material reviewed. Provide a narrative account. Identify implications.',
				expectedOutputs: ['narrative_summary', 'thematic_synthesis', 'gap_map']
			}
		]
	},
	{
		name: 'JBI Scoping Review Framework',
		description:
			'Joanna Briggs Institute methodology for scoping reviews. Provides rigorous, transparent methods for mapping evidence on a topic. Builds on Arksey & O\'Malley with enhanced guidance.',
		type: 'scoping',
		domain: 'health',
		phases: [
			{
				name: 'Define Objectives & Question',
				description: 'Develop objectives and review question using PCC (Population, Concept, Context) elements.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Develop Inclusion Criteria',
				description: 'Define eligibility criteria aligned with the review question. Consider types of participants, concept, context, and sources.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Search Strategy',
				description: 'Three-step search: initial limited search, analysis of text words, comprehensive search across all databases.',
				expectedOutputs: ['search_strategy_log']
			},
			{
				name: 'Source Selection',
				description: 'Two-stage screening (title/abstract then full text). Use at least two reviewers.',
				expectedOutputs: ['prisma_flow_diagram', 'inclusion_exclusion_table']
			},
			{
				name: 'Data Extraction',
				description: 'Extract data using JBI data extraction instrument. Pilot test and refine.',
				expectedOutputs: ['data_extraction_matrix']
			},
			{
				name: 'Presentation of Results',
				description: 'Map results in tabular and/or diagrammatic format. Provide narrative summary aligned with objectives.',
				expectedOutputs: ['systematic_map_table', 'narrative_summary', 'gap_map']
			}
		]
	},
	// ── Question Frameworks ─────────────────────────────────────────
	{
		name: 'PICO / PICOS / PICOT',
		description:
			'Population, Intervention, Comparison, Outcome (+ Study design / + Timeframe). The standard framework for formulating clinical and research questions in evidence-based practice.',
		type: 'systematic',
		domain: 'health',
		phases: [
			{
				name: 'Define PICO Elements',
				description: 'Identify the Population, Intervention, Comparison, and Outcome. Optionally define Study design (S) or Timeframe (T).',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Develop Search Strategy',
				description: 'Translate PICO elements into search terms. Build Boolean queries for each database.',
				expectedOutputs: ['search_strategy_log']
			},
			{
				name: 'Search & Screen',
				description: 'Execute searches and screen results against PICO-derived eligibility criteria.',
				expectedOutputs: ['inclusion_exclusion_table', 'prisma_flow_diagram']
			},
			{
				name: 'Appraise & Extract',
				description: 'Critically appraise included studies. Extract data organized by PICO elements.',
				expectedOutputs: ['quality_appraisal_table', 'data_extraction_matrix']
			},
			{
				name: 'Synthesize',
				description: 'Synthesize findings organized by outcome. Assess strength of evidence.',
				expectedOutputs: ['narrative_summary', 'summary_of_findings', 'grade_evidence_table']
			}
		]
	},
	{
		name: 'SPIDER',
		description:
			'Sample, Phenomenon of Interest, Design, Evaluation, Research type. An alternative to PICO designed for qualitative and mixed-methods research questions.',
		type: 'qualitative',
		domain: 'general',
		phases: [
			{
				name: 'Define SPIDER Elements',
				description: 'Identify: Sample (who), Phenomenon of Interest (what), Design (how), Evaluation (outcomes), Research type (qual/quant/mixed).',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Search Strategy',
				description: 'Build searches using SPIDER elements. Focus on qualitative databases and sources.',
				expectedOutputs: ['search_strategy_log']
			},
			{
				name: 'Selection & Appraisal',
				description: 'Screen and select studies. Appraise qualitative rigour using appropriate tools (e.g., CASP).',
				expectedOutputs: ['inclusion_exclusion_table', 'quality_appraisal_table']
			},
			{
				name: 'Synthesis',
				description: 'Synthesize qualitative findings thematically. Develop a conceptual framework.',
				expectedOutputs: ['thematic_synthesis', 'conceptual_framework', 'narrative_summary']
			}
		]
	},
	// ── Qualitative Synthesis ───────────────────────────────────────
	{
		name: 'ENTREQ',
		description:
			'Enhancing Transparency in Reporting the Synthesis of Qualitative Research. A 21-item framework for transparently reporting qualitative evidence syntheses.',
		type: 'qualitative',
		domain: 'health',
		phases: [
			{
				name: 'Introduction & Question',
				description: 'State the review question and rationale. Describe the synthesis methodology chosen.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Search & Selection',
				description: 'Detail the search strategy, databases, and selection process.',
				expectedOutputs: ['search_strategy_log', 'inclusion_exclusion_table']
			},
			{
				name: 'Appraisal',
				description: 'Describe the quality appraisal method, criteria, and how results influenced synthesis.',
				expectedOutputs: ['quality_appraisal_table']
			},
			{
				name: 'Synthesis Methodology',
				description: 'Describe the synthesis approach (thematic, framework, meta-ethnography, etc.). Develop coding framework.',
				expectedOutputs: ['coding_framework', 'thematic_synthesis']
			},
			{
				name: 'Results & Reporting',
				description: 'Present synthesized findings with supporting evidence. Report confidence in findings.',
				expectedOutputs: ['narrative_summary', 'conceptual_framework']
			}
		]
	},
	{
		name: 'Meta-ethnography (Noblit & Hare)',
		description:
			'A seven-phase interpretive approach to synthesizing qualitative studies. Goes beyond aggregation to create new interpretations through translation of concepts across studies.',
		type: 'qualitative',
		domain: 'social_sciences',
		phases: [
			{
				name: 'Getting Started',
				description: 'Identify an intellectual interest and area to synthesize.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Deciding What Is Relevant',
				description: 'Define focus and locate relevant studies through systematic searching.',
				expectedOutputs: ['search_strategy_log', 'inclusion_exclusion_table']
			},
			{
				name: 'Reading the Studies',
				description: 'Read studies repeatedly. Note interpretive metaphors, themes, and concepts.',
				expectedOutputs: ['data_extraction_matrix']
			},
			{
				name: 'Determining How Studies Are Related',
				description: 'Create a list of key metaphors/themes from each study. Juxtapose them to identify relationships.',
				expectedOutputs: ['coding_framework']
			},
			{
				name: 'Translating Studies Into One Another',
				description: 'Compare concepts across studies: reciprocal translation (similar), refutational (contradictory), or line-of-argument.',
				expectedOutputs: ['thematic_synthesis']
			},
			{
				name: 'Synthesizing Translations',
				description: 'Develop a line-of-argument synthesis — a new overarching interpretation that goes beyond individual studies.',
				expectedOutputs: ['conceptual_framework', 'narrative_summary']
			},
			{
				name: 'Expressing the Synthesis',
				description: 'Present the synthesis in an appropriate form for the intended audience.',
				expectedOutputs: ['narrative_summary', 'annotated_bibliography']
			}
		]
	},
	// ── Evidence Quality & Appraisal ────────────────────────────────
	{
		name: 'GRADE',
		description:
			'Grading of Recommendations, Assessment, Development and Evaluations. Rates the certainty of evidence for each outcome across studies from high to very low.',
		type: 'systematic',
		domain: 'health',
		phases: [
			{
				name: 'Frame the Question',
				description: 'Define the health question with population, intervention, comparator, and outcomes.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Identify Evidence',
				description: 'Conduct a systematic search and select studies for each outcome.',
				expectedOutputs: ['search_strategy_log', 'inclusion_exclusion_table']
			},
			{
				name: 'Assess Study Quality',
				description: 'Evaluate risk of bias, inconsistency, indirectness, imprecision, and publication bias for each outcome.',
				expectedOutputs: ['risk_of_bias_table', 'quality_appraisal_table']
			},
			{
				name: 'Rate Certainty',
				description: 'Assign GRADE rating (High/Moderate/Low/Very Low) per outcome. Create evidence profile.',
				expectedOutputs: ['grade_evidence_table', 'summary_of_findings']
			}
		]
	},
	{
		name: 'CASP',
		description:
			'Critical Appraisal Skills Programme. Provides checklists for appraising different study designs (RCTs, qualitative, cohort, case-control, etc.).',
		type: 'systematic',
		domain: 'health',
		phases: [
			{
				name: 'Select Checklist',
				description: 'Choose the appropriate CASP checklist based on study designs in your review.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Apply Checklist',
				description: 'For each included study, answer the CASP questions. Score validity, results, and applicability.',
				expectedOutputs: ['quality_appraisal_table']
			},
			{
				name: 'Summarize Quality',
				description: 'Tabulate quality scores. Decide on inclusion threshold. Report quality assessment.',
				expectedOutputs: ['quality_appraisal_table', 'study_characteristics_table']
			}
		]
	},
	{
		name: 'Newcastle-Ottawa Scale',
		description:
			'A tool for assessing quality of non-randomized studies (cohort and case-control) in systematic reviews. Evaluates selection, comparability, and outcome/exposure.',
		type: 'systematic',
		domain: 'health',
		phases: [
			{
				name: 'Identify Study Design',
				description: 'Determine whether each study is cohort or case-control. Select appropriate NOS form.',
				expectedOutputs: ['study_characteristics_table']
			},
			{
				name: 'Assess Selection',
				description: 'Evaluate representativeness, selection of controls, ascertainment of exposure.',
				expectedOutputs: ['quality_appraisal_table']
			},
			{
				name: 'Assess Comparability',
				description: 'Evaluate whether studies control for confounders.',
				expectedOutputs: ['quality_appraisal_table']
			},
			{
				name: 'Assess Outcome/Exposure',
				description: 'Evaluate outcome assessment, follow-up duration and adequacy.',
				expectedOutputs: ['quality_appraisal_table', 'risk_of_bias_table']
			}
		]
	},
	{
		name: 'SANRA',
		description:
			'Scale for the Assessment of Narrative Review Articles. A six-item tool for evaluating the quality of narrative (non-systematic) reviews.',
		type: 'rapid',
		domain: 'general',
		phases: [
			{
				name: 'Justify the Article\'s Importance',
				description: 'Assess whether the review justifies why the topic is important.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Define Aims',
				description: 'Evaluate clarity of the review\'s stated aims or research questions.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Evaluate Literature Search',
				description: 'Assess the description of the literature search strategy.',
				expectedOutputs: ['search_strategy_log']
			},
			{
				name: 'Evaluate Referencing & Presentation',
				description: 'Assess appropriate referencing, scientific reasoning, and presentation of data.',
				expectedOutputs: ['quality_appraisal_table', 'narrative_summary']
			}
		]
	},
	// ── Integrative & Mixed Methods ─────────────────────────────────
	{
		name: 'Whittemore & Knafl Framework',
		description:
			'An integrative review methodology that allows inclusion of diverse research designs (experimental and non-experimental). Five-stage process: problem identification, literature search, data evaluation, data analysis, and presentation.',
		type: 'mixed',
		domain: 'health',
		phases: [
			{
				name: 'Problem Identification',
				description: 'Clearly identify the problem and purpose. Define variables and concepts of interest.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Literature Search',
				description: 'Conduct a comprehensive search. Document search strategy including databases and terms.',
				expectedOutputs: ['search_strategy_log']
			},
			{
				name: 'Data Evaluation',
				description: 'Evaluate quality of primary sources. Use different criteria for different study designs.',
				expectedOutputs: ['quality_appraisal_table', 'inclusion_exclusion_table']
			},
			{
				name: 'Data Analysis',
				description: 'Reduce data, display data, compare data across sources, draw conclusions and verify.',
				expectedOutputs: ['data_extraction_matrix', 'thematic_synthesis', 'coding_framework']
			},
			{
				name: 'Presentation',
				description: 'Synthesize and present findings. Identify gaps and directions for future research.',
				expectedOutputs: ['narrative_summary', 'gap_map', 'conceptual_framework']
			}
		]
	},
	{
		name: 'PROSPERO',
		description:
			'International Prospective Register of Systematic Reviews. Not a methodology per se, but a protocol registration process that ensures transparency and reduces duplication.',
		type: 'systematic',
		domain: 'health',
		phases: [
			{
				name: 'Draft Protocol',
				description: 'Write the review protocol including: title, research question, search strategy, eligibility criteria, outcomes, risk of bias approach, and synthesis plan.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Register on PROSPERO',
				description: 'Submit the protocol to PROSPERO. The registration record becomes public and citable.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Conduct & Update',
				description: 'Conduct the review following the registered protocol. Update the registration when the review is complete.',
				expectedOutputs: ['search_strategy_log', 'narrative_summary']
			}
		]
	},
	// ── Software Engineering ────────────────────────────────────────
	{
		name: 'SLURP',
		description:
			'Systematic Literature Update and Review Protocol. A lightweight SLR process for software engineering that emphasizes reproducibility and practical applicability.',
		type: 'systematic',
		domain: 'software_engineering',
		phases: [
			{
				name: 'Define Scope',
				description: 'Define research questions and scope. Establish search and selection criteria.',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Search',
				description: 'Search digital libraries. Document queries and results per database.',
				expectedOutputs: ['search_strategy_log']
			},
			{
				name: 'Select',
				description: 'Apply inclusion/exclusion criteria. Log decisions for each study.',
				expectedOutputs: ['inclusion_exclusion_table', 'prisma_flow_diagram']
			},
			{
				name: 'Assess Quality',
				description: 'Apply quality checklist criteria to each included study.',
				expectedOutputs: ['quality_appraisal_table']
			},
			{
				name: 'Extract & Synthesize',
				description: 'Extract data into matrix. Synthesize findings.',
				expectedOutputs: ['data_extraction_matrix', 'narrative_summary', 'systematic_map_table']
			}
		]
	},
	{
		name: 'Mapping Studies',
		description:
			'Systematic mapping studies (also called scoping studies in SE) provide a broad overview of a research area by classifying and counting studies. Focused on categorization rather than synthesis.',
		type: 'mapping',
		domain: 'software_engineering',
		phases: [
			{
				name: 'Define Research Questions',
				description: 'Define broad RQs aimed at classification and mapping (e.g., "What topics are covered?", "What research methods are used?").',
				expectedOutputs: ['protocol_document']
			},
			{
				name: 'Search',
				description: 'Search relevant digital libraries and venues.',
				expectedOutputs: ['search_strategy_log']
			},
			{
				name: 'Screening',
				description: 'Apply inclusion/exclusion criteria based on relevance to the map scope.',
				expectedOutputs: ['inclusion_exclusion_table']
			},
			{
				name: 'Classification',
				description: 'Classify studies using a classification scheme (by topic, method, venue, year, etc.).',
				expectedOutputs: ['systematic_map_table', 'coding_framework']
			},
			{
				name: 'Mapping & Visualization',
				description: 'Create visual maps: bubble charts, heat maps, or frequency tables showing research landscape.',
				expectedOutputs: ['systematic_map_table', 'bibliometric_analysis', 'gap_map', 'narrative_summary']
			}
		]
	}
];

export async function seedMethodologies(): Promise<{ inserted: number; total: number }> {
	// Check if already seeded
	const existing = await db.select({ id: reviewMethodologies.id }).from(reviewMethodologies).limit(1);
	if (existing.length > 0) {
		return { inserted: 0, total: METHODOLOGIES.length };
	}

	let inserted = 0;

	for (const method of METHODOLOGIES) {
		const [m] = await db
			.insert(reviewMethodologies)
			.values({
				name: method.name,
				description: method.description,
				type: method.type,
				domain: method.domain,
				isBuiltIn: true
			})
			.returning({ id: reviewMethodologies.id });

		for (let i = 0; i < method.phases.length; i++) {
			const phase = method.phases[i];
			await db.insert(methodologyPhases).values({
				methodologyId: m.id,
				name: phase.name,
				description: phase.description,
				position: i,
				expectedOutputs: JSON.stringify(phase.expectedOutputs)
			});
		}

		inserted++;
	}

	console.log(`[seed] Inserted ${inserted} built-in review methodologies`);
	return { inserted, total: METHODOLOGIES.length };
}
