const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate sample PDF documents for testing
 * This creates PDFs and properly registers them in the database
 */
async function generateSampleDocuments() {
  console.log('📄 Generating sample PDF documents...');

  try {
    // Initialize database connection
    await db.initialize();
    
    // Get demo user
    const demoUser = await db.get('SELECT * FROM users WHERE email = ?', ['demo@pdfsign.com']);
    if (!demoUser) {
      console.log('❌ Demo user not found. Please run user seeder first.');
      return;
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../../uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Sample documents to generate
    const documents = [
      {
        name: 'Non-Disclosure Agreement',
        filename: 'nda-template.pdf',
        content: generateNDAContent()
      },
      {
        name: 'Employment Contract',
        filename: 'employment-contract.pdf',
        content: generateEmploymentContent()
      },
      {
        name: 'Service Agreement',
        filename: 'service-agreement.pdf',
        content: generateServiceAgreementContent()
      },
      {
        name: 'Real Estate Purchase Agreement',
        filename: 'real-estate-agreement.pdf',
        content: generateRealEstateContent()
      },
      {
        name: 'Consulting Agreement',
        filename: 'consulting-agreement.pdf',
        content: generateConsultingContent()
      }
    ];

    for (const docData of documents) {
      await generateAndSavePDF(docData, demoUser.id);
    }

    console.log(`✅ Generated ${documents.length} sample documents successfully!`);

  } catch (error) {
    console.error('❌ Error generating sample documents:', error);
  } finally {
    await db.close();
  }
}

async function generateAndSavePDF(docData, userId) {
  const doc = new PDFDocument();
  const filename = `${Date.now()}-${docData.filename}`;
  const filepath = path.join(__dirname, '../../uploads', filename);

  // Create the PDF
  const stream = doc.pipe(require('fs').createWriteStream(filepath));

  // Add content
  doc.fontSize(20).text(docData.name, 100, 100);
  doc.fontSize(12);
  
  const lines = docData.content.split('\n');
  let y = 150;
  
  for (const line of lines) {
    if (y > 700) { // Start new page if needed
      doc.addPage();
      y = 100;
    }
    doc.text(line, 100, y);
    y += 20;
  }

  doc.end();

  // Wait for PDF to be written
  await new Promise((resolve) => stream.on('finish', resolve));

  // Get file stats
  const stats = await fs.stat(filepath);

  // Register in database
  const documentUuid = uuidv4();
  const result = await db.run(
    `INSERT INTO documents (
      uuid, user_id, original_name, filename, file_size, mime_type, status, total_pages
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      documentUuid,
      userId,
      docData.name + '.pdf',
      filename,
      stats.size,
      'application/pdf',
      'draft',
      1
    ]
  );

  console.log(`✅ Generated ${docData.name} (${filename})`);
  return result.id;
}

function generateNDAContent() {
  return `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on [DATE] by and between:

DISCLOSING PARTY:
Name: [COMPANY_NAME]
Address: [COMPANY_ADDRESS]

RECEIVING PARTY:
Name: [RECIPIENT_NAME]
Address: [RECIPIENT_ADDRESS]

WHEREAS, the Disclosing Party possesses certain confidential and proprietary information;

WHEREAS, the Receiving Party desires to receive such confidential information for the purpose of [PURPOSE];

NOW, THEREFORE, in consideration of the mutual covenants contained herein, the parties agree as follows:

1. CONFIDENTIAL INFORMATION
The term "Confidential Information" shall mean any and all non-public, confidential or proprietary information disclosed by the Disclosing Party.

2. OBLIGATIONS OF RECEIVING PARTY
The Receiving Party agrees to:
a) Hold all Confidential Information in strict confidence
b) Not disclose any Confidential Information to third parties
c) Use Confidential Information solely for the Purpose

3. TERM
This Agreement shall remain in effect for a period of [TERM] years from the date of execution.

4. REMEDIES
The Receiving Party acknowledges that any breach of this Agreement may cause irreparable harm.

Signature of Disclosing Party: _________________________    Date: __________

Signature of Receiving Party: _________________________    Date: __________`;
}

function generateEmploymentContent() {
  return `EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is made between:

EMPLOYER:
Company: [COMPANY_NAME]
Address: [COMPANY_ADDRESS]

EMPLOYEE:
Name: [EMPLOYEE_NAME]
Address: [EMPLOYEE_ADDRESS]

1. POSITION AND DUTIES
The Employee shall serve as [POSITION] and shall perform duties as assigned.

2. COMPENSATION
Base Salary: $[SALARY] per year, payable in accordance with company payroll practices.

3. BENEFITS
Employee shall be entitled to participate in company benefit programs.

4. TERM OF EMPLOYMENT
This agreement shall commence on [START_DATE] and continue until terminated.

5. TERMINATION
Either party may terminate this agreement with [NOTICE_PERIOD] days written notice.

6. CONFIDENTIALITY
Employee agrees to maintain confidentiality of all proprietary company information.

7. NON-COMPETE
Employee agrees not to compete with the company during employment and for [PERIOD] after termination.

Employee Signature: _________________________    Date: __________

Employer Signature: _________________________    Date: __________`;
}

function generateServiceAgreementContent() {
  return `SERVICE AGREEMENT

This Service Agreement is entered into between:

SERVICE PROVIDER:
Name: [PROVIDER_NAME]
Address: [PROVIDER_ADDRESS]

CLIENT:
Name: [CLIENT_NAME]
Address: [CLIENT_ADDRESS]

1. SERVICES
The Service Provider agrees to provide the following services:
[DESCRIPTION_OF_SERVICES]

2. PAYMENT TERMS
Total Fee: $[AMOUNT]
Payment Schedule: [PAYMENT_TERMS]

3. TIMELINE
Services shall commence on [START_DATE] and be completed by [END_DATE].

4. DELIVERABLES
The following deliverables shall be provided:
- [DELIVERABLE_1]
- [DELIVERABLE_2]
- [DELIVERABLE_3]

5. INTELLECTUAL PROPERTY
All work products shall belong to [OWNER].

6. LIMITATION OF LIABILITY
Service Provider's liability shall be limited to the amount paid under this agreement.

Service Provider Signature: _________________________    Date: __________

Client Signature: _________________________    Date: __________`;
}

function generateRealEstateContent() {
  return `REAL ESTATE PURCHASE AGREEMENT

BUYER:
Name: [BUYER_NAME]
Address: [BUYER_ADDRESS]

SELLER:
Name: [SELLER_NAME]
Address: [SELLER_ADDRESS]

PROPERTY:
Address: [PROPERTY_ADDRESS]
Legal Description: [LEGAL_DESCRIPTION]

1. PURCHASE PRICE
The total purchase price is $[PURCHASE_PRICE].

2. EARNEST MONEY
Buyer shall deposit $[EARNEST_MONEY] as earnest money.

3. FINANCING
This purchase is contingent upon buyer obtaining financing.

4. INSPECTION
Buyer has [INSPECTION_DAYS] days to complete property inspection.

5. CLOSING
Closing shall occur on or before [CLOSING_DATE].

6. TITLE
Seller shall provide clear and marketable title.

7. POSSESSION
Possession shall be transferred at closing.

Buyer Signature: _________________________    Date: __________

Seller Signature: _________________________    Date: __________

Real Estate Agent: _________________________    Date: __________`;
}

function generateConsultingContent() {
  return `CONSULTING AGREEMENT

CONSULTANT:
Name: [CONSULTANT_NAME]
Address: [CONSULTANT_ADDRESS]

CLIENT:
Name: [CLIENT_NAME]
Address: [CLIENT_ADDRESS]

1. CONSULTING SERVICES
Consultant shall provide the following services:
[SCOPE_OF_WORK]

2. COMPENSATION
Hourly Rate: $[HOURLY_RATE]
Maximum Total: $[MAX_AMOUNT]

3. SCHEDULE
Services shall be performed between [START_DATE] and [END_DATE].

4. INDEPENDENT CONTRACTOR
Consultant is an independent contractor, not an employee.

5. CONFIDENTIALITY
Consultant agrees to maintain confidentiality of all client information.

6. OWNERSHIP OF WORK PRODUCT
All work products shall be owned by Client.

7. TERMINATION
Either party may terminate with [NOTICE_PERIOD] days notice.

Consultant Signature: _________________________    Date: __________

Client Signature: _________________________    Date: __________`;
}

// Run the script if called directly
if (require.main === module) {
  generateSampleDocuments();
}

module.exports = { generateSampleDocuments };
