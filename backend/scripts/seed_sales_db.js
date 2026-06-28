require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const SalesPlaybook = require('../models/SalesPlaybook');
const SalesInteraction = require('../models/SalesInteraction');

// ---------------------------------------------------------------------------
// Deterministic seed data
// ---------------------------------------------------------------------------

const salesPlaybooks = [
  {
    scenarioName: 'Aggressive Competitor Displacement',
    targetIndustry: 'FinTech',
    recommendedAction: 'Offer a free 90-day migration program with dedicated onboarding engineer and guaranteed SLA parity with incumbent vendor.',
    discountCap: 25
  },
  {
    scenarioName: 'Enterprise Upsell',
    targetIndustry: 'HealthTech',
    recommendedAction: 'Present ROI analysis showing cost savings at scale, bundle compliance modules, and propose a multi-year commitment discount.',
    discountCap: 15
  },
  {
    scenarioName: 'Startup Land-and-Expand',
    targetIndustry: 'EdTech',
    recommendedAction: 'Start with a free-tier pilot for one department, then expand with usage-based pricing after demonstrating value in the first quarter.',
    discountCap: 40
  }
];

const leads = [
  { companyName: 'Apex Analytics Inc.', industry: 'FinTech', estimatedBudget: 120000, currentVendor: 'Datadog', decisionMaker: 'Priya Sharma, VP Engineering' },
  { companyName: 'BrightPath Health', industry: 'HealthTech', estimatedBudget: 250000, currentVendor: 'Salesforce Health Cloud', decisionMaker: 'James Chen, CTO' },
  { companyName: 'CloudNine Labs', industry: 'DevTools', estimatedBudget: 85000, currentVendor: 'PagerDuty', decisionMaker: 'Maria Lopez, Director of Infra' },
  { companyName: 'DataWeave Solutions', industry: 'FinTech', estimatedBudget: 310000, currentVendor: 'Splunk', decisionMaker: 'Raj Patel, CIO' },
  { companyName: 'EduSpark Global', industry: 'EdTech', estimatedBudget: 60000, currentVendor: 'Canvas LMS', decisionMaker: 'Sarah Kim, Head of Product' },
  { companyName: 'Frontier Logistics', industry: 'Supply Chain', estimatedBudget: 175000, currentVendor: 'Oracle SCM', decisionMaker: 'David Okonkwo, COO' },
  { companyName: 'GreenGrid Energy', industry: 'CleanTech', estimatedBudget: 200000, currentVendor: 'Siemens MindSphere', decisionMaker: 'Lena Johansson, VP Operations' },
  { companyName: 'HyperLoop AI', industry: 'AI/ML', estimatedBudget: 450000, currentVendor: 'AWS SageMaker', decisionMaker: 'Alex Novak, CEO' },
  { companyName: 'InfraScale Corp.', industry: 'DevTools', estimatedBudget: 95000, currentVendor: 'HashiCorp', decisionMaker: 'Tomoko Sato, Engineering Lead' },
  { companyName: 'JetStream Media', industry: 'AdTech', estimatedBudget: 130000, currentVendor: 'Google Ad Manager', decisionMaker: 'Carlos Rivera, CMO' },
  { companyName: 'Kryptos Security', industry: 'Cybersecurity', estimatedBudget: 280000, currentVendor: 'CrowdStrike', decisionMaker: 'Anika Desai, CISO' },
  { companyName: 'LumenAI Diagnostics', industry: 'HealthTech', estimatedBudget: 340000, currentVendor: 'Epic Systems', decisionMaker: 'Dr. Brian Walker, Chief Medical Officer' },
  { companyName: 'MeshPoint Networks', industry: 'Telecom', estimatedBudget: 190000, currentVendor: 'Cisco Meraki', decisionMaker: 'Nina Petrova, VP Network Engineering' },
  { companyName: 'NovaPay Systems', industry: 'FinTech', estimatedBudget: 500000, currentVendor: 'Stripe', decisionMaker: 'Omar Hassan, Head of Payments' },
  { companyName: 'Orbitly SaaS', industry: 'HR Tech', estimatedBudget: 72000, currentVendor: 'Workday', decisionMaker: 'Emily Zhang, People Ops Director' },
  { companyName: 'PulseMetrics', industry: 'HealthTech', estimatedBudget: 155000, currentVendor: 'Tableau', decisionMaker: 'Dr. Fatima Al-Rashid, Data Science Lead' },
  { companyName: 'QuantEdge Capital', industry: 'FinTech', estimatedBudget: 620000, currentVendor: 'Bloomberg Terminal', decisionMaker: 'Michael Torres, Head of Quant Research' },
  { companyName: 'RapidShip Fulfillment', industry: 'Supply Chain', estimatedBudget: 110000, currentVendor: 'ShipBob', decisionMaker: 'Grace Tanaka, Logistics Manager' },
  { companyName: 'SkyVault Storage', industry: 'Cloud Infrastructure', estimatedBudget: 380000, currentVendor: 'Backblaze B2', decisionMaker: 'Kevin Murphy, VP Cloud Architecture' },
  { companyName: 'TerraByte Analytics', industry: 'AI/ML', estimatedBudget: 270000, currentVendor: 'Databricks', decisionMaker: 'Sophia Andersen, ML Engineering Manager' }
];

// Realistic B2B email transcript snippets — each references a lead by index
const interactionTranscripts = [
  {
    leadIndex: 0,
    rawTranscript: 'Hi team,\n\nWe are currently using Datadog for our observability stack but their API rate limits are bottlenecking our deployment pipeline. We process roughly 2.3M events per minute during peak hours. What is your enterprise pricing for a comparable ingestion rate? Also, do you support custom metric aggregation windows?\n\nBest,\nPriya Sharma\nVP Engineering, Apex Analytics Inc.',
    status: 'pending_review'
  },
  {
    leadIndex: 1,
    rawTranscript: 'James here from BrightPath Health. We have been evaluating alternatives to Salesforce Health Cloud because the per-seat licensing model does not scale for our 400+ clinician user base. Can you walk us through your HIPAA compliance certifications and whether your platform supports HL7 FHIR data interoperability out of the box?\n\nRegards,\nJames Chen, CTO',
    status: 'pending_review'
  },
  {
    leadIndex: 3,
    rawTranscript: 'Good morning,\n\nOur Splunk license renewal is coming up in Q3 and we are exploring more cost-effective log analytics solutions. Our primary requirements are real-time alerting on financial transaction anomalies and SOC 2 Type II compliance. Could you share a technical comparison document and arrange a proof-of-concept in our staging environment?\n\nThanks,\nRaj Patel\nCIO, DataWeave Solutions',
    status: 'pending_review'
  },
  {
    leadIndex: 4,
    rawTranscript: 'Hi,\n\nI lead product at EduSpark. We are looking for a lightweight LMS integration layer that can plug into our existing Canvas setup without replacing it. Budget is tight — around $60K annually — but we need SSO, custom analytics dashboards, and a student engagement API. Is there a starter plan that fits?\n\nThanks,\nSarah Kim',
    status: 'completed'
  },
  {
    leadIndex: 5,
    rawTranscript: 'Dear Sales Team,\n\nFrontier Logistics operates a fleet of 1,200 vehicles across 14 distribution centers. Our Oracle SCM implementation has become a maintenance burden and we need a modern, API-first supply chain visibility platform. Key requirements: real-time GPS tracking, automated ETA recalculation, and integration with our existing SAP ERP. Please send your solution architecture deck.\n\nBest regards,\nDavid Okonkwo, COO',
    status: 'pending_review'
  },
  {
    leadIndex: 7,
    rawTranscript: 'Hi,\n\nAlex Novak, CEO of HyperLoop AI. We are scaling our ML training infrastructure beyond what SageMaker can handle — specifically, we need multi-region GPU cluster orchestration with spot instance failover. Our monthly compute spend is approximately $37K and growing 20% QoQ. Looking for a managed platform that reduces our MLOps overhead. Can we schedule a technical deep-dive this week?\n\nCheers,\nAlex',
    status: 'pending_review'
  },
  {
    leadIndex: 8,
    rawTranscript: 'Hello,\n\nWe have been using HashiCorp Vault and Terraform for our infrastructure provisioning but the learning curve for our junior engineers is steep. We are a 45-person DevTools company and need something with better developer UX. Do you offer a migration path from Terraform state files and can your secrets management handle cross-cloud key rotation?\n\nTomoko Sato\nEngineering Lead, InfraScale Corp.',
    status: 'completed'
  },
  {
    leadIndex: 10,
    rawTranscript: 'Anika Desai, CISO at Kryptos Security. We are supplementing our CrowdStrike EDR deployment with a SIEM solution. Our SOC processes about 50GB of log data daily across 3,000 endpoints. We need native integration with our existing CrowdStrike Falcon instance, automated threat intelligence correlation, and compliance reporting for PCI DSS and ISO 27001. What does your pricing look like for this volume?\n\nRegards,\nAnika',
    status: 'pending_review'
  },
  {
    leadIndex: 11,
    rawTranscript: 'Dr. Brian Walker here, CMO at LumenAI Diagnostics. We are building a clinical decision support tool on top of our Epic EHR and need an AI inference platform that meets FDA 510(k) requirements for SaMD. Currently exploring alternatives because our AWS deployment does not meet our latency targets for real-time radiology image analysis. Can your edge computing solution guarantee sub-200ms inference times?\n\nBest,\nDr. Walker',
    status: 'pending_review'
  },
  {
    leadIndex: 13,
    rawTranscript: 'Hi,\n\nOmar Hassan from NovaPay Systems. We process $2.1B in annual payment volume through Stripe but their interchange-plus pricing is eroding our margins on micro-transactions. We need a payment orchestration layer that supports intelligent routing across multiple acquirers, dynamic currency conversion, and real-time fraud scoring. Our budget for this initiative is $500K. Can we set up a pilot with production traffic?\n\nOmar Hassan\nHead of Payments',
    status: 'pending_review'
  },
  {
    leadIndex: 14,
    rawTranscript: 'Hello,\n\nEmily Zhang from Orbitly SaaS. We are a 200-person company currently on Workday but finding it overkill for our needs. We want a more agile HR platform with strong API support for building custom onboarding workflows, automated compliance tracking for our remote employees across 8 countries, and integration with Slack. Budget is constrained at $72K/year. What tier would you recommend?\n\nThanks,\nEmily',
    status: 'completed'
  },
  {
    leadIndex: 16,
    rawTranscript: 'Michael Torres, Head of Quant Research at QuantEdge Capital. We are evaluating replacements for several Bloomberg Terminal seats — specifically the data feed and analytics components, not the trading execution. We need tick-level market data with less than 5ms latency, custom factor model backtesting, and Python/R SDK integration. Our budget ceiling is $620K annually for 15 analyst seats. Requesting a demo with live market data.\n\nMichael Torres',
    status: 'pending_review'
  },
  {
    leadIndex: 17,
    rawTranscript: 'Hi there,\n\nGrace Tanaka, Logistics Manager at RapidShip Fulfillment. ShipBob has been our 3PL partner but we are bringing fulfillment in-house. We need warehouse management software that supports barcode scanning, automated pick-path optimization, and real-time inventory sync with our Shopify storefront. Ideally under $110K/year including implementation. Is your solution a fit for a mid-market operation like ours?\n\nGrace',
    status: 'pending_review'
  },
  {
    leadIndex: 18,
    rawTranscript: 'Kevin Murphy, VP Cloud Architecture at SkyVault Storage. We currently use Backblaze B2 for cold storage but need a unified storage platform that handles both hot and cold tiers with automatic lifecycle policies. Our data footprint is 4.2 PB and growing. Key requirements: S3-compatible API, geo-redundancy across at least 3 regions, and sub-100ms first-byte latency on the hot tier. Please share your per-TB pricing model.\n\nKevin Murphy',
    status: 'pending_review'
  },
  {
    leadIndex: 19,
    rawTranscript: 'Hi,\n\nSophia Andersen, ML Engineering Manager at TerraByte Analytics. We have outgrown Databricks for our feature engineering pipelines — specifically, their Spark-based transformations are too slow for our real-time streaming use case (Kafka ingestion at 500K events/sec). We need a feature store with sub-second materialization, native Kafka connectors, and Python SDK support. Can you benchmark against our current setup?\n\nBest,\nSophia',
    status: 'completed'
  }
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment variables.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Drop existing B2B collections
    console.log('Dropping existing collections...');
    for (const Model of [SalesInteraction, SalesPlaybook, Lead]) {
      try {
        await Model.collection.drop();
        console.log(`  Dropped ${Model.collection.collectionName} collection.`);
      } catch (e) {
        console.log(`  ${Model.collection.collectionName} collection does not exist, skipping drop.`);
      }
    }

    // 1. Seed SalesPlaybooks (3)
    console.log('\nSeeding SalesPlaybook documents (3)...');
    const insertedPlaybooks = await SalesPlaybook.insertMany(salesPlaybooks);
    console.log(`  Inserted ${insertedPlaybooks.length} playbooks.`);

    // 2. Seed Leads (20)
    console.log('Seeding Lead documents (20)...');
    const insertedLeads = await Lead.insertMany(leads);
    console.log(`  Inserted ${insertedLeads.length} leads.`);

    // 3. Seed SalesInteractions (15) — link each to its lead by index
    console.log('Seeding SalesInteraction documents (15)...');
    const interactions = interactionTranscripts.map((entry, i) => ({
      leadId: insertedLeads[entry.leadIndex]._id,
      rawTranscript: entry.rawTranscript,
      status: entry.status,
      timestamp: new Date(Date.UTC(2026, 5, 15 - i)) // Deterministic dates: June 15 → June 1, 2026
    }));
    const insertedInteractions = await SalesInteraction.insertMany(interactions);
    console.log(`  Inserted ${insertedInteractions.length} sales interactions.`);

    console.log('\n✓ Database seeding completed successfully.');
    console.log(`  Summary: ${insertedPlaybooks.length} playbooks, ${insertedLeads.length} leads, ${insertedInteractions.length} interactions.`);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    console.log('Closing database connection...');
    await mongoose.connection.close();
    console.log('Exiting process safely.');
    process.exit(0);
  }
}

seedDatabase();
