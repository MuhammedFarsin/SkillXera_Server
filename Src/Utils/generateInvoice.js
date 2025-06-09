const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const generateInvoice = (payment, courseDetails) => {
  return new Promise((resolve, reject) => {
    const invoicesDir = path.join(__dirname, "invoices");

    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
      console.log("✅ Created invoices folder:", invoicesDir);
    }

    const filePath = path.join(invoicesDir, `invoice_${payment.orderId}.pdf`);
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // 📝 Invoice Header
    doc.fontSize(20).text("Invoice", { align: "center" }).moveDown();

    // 📌 Payment Details
    doc
      .fontSize(12)
      .text(`Invoice Number: ${payment.orderId}`)
      .text(`Date: ${new Date().toLocaleDateString()}`)
      .moveDown();

    // 📌 Customer Details
    doc.text(`Customer: ${payment.username}`).text(`Email: ${payment.email}`).moveDown();

    // 📌 Course Details
    doc.text(`Course: ${courseDetails.title}`)
      .text(`Amount: ₹${payment.amount}`)
      .text(`Payment Method: ${payment.paymentMethod}`)
      .moveDown();

    doc.text("Thank you for your purchase!", { align: "center" });

    doc.end();

    writeStream.on("finish", () => {
      console.log("✅ Invoice generated:", filePath);
      resolve(filePath);
    });

    writeStream.on("error", (error) => {
      console.error("❌ Error writing invoice file:", error);
      reject(error);
    });
  });
};

module.exports = generateInvoice;
