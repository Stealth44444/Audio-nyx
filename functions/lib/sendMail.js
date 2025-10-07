"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = void 0;
const functions = __importStar(require("firebase-functions"));
const nodemailer = __importStar(require("nodemailer"));
// 하드코딩된 Gmail 설정 (테스트용)
const gmailUser = "audionyx369@gmail.com";
const gmailPass = "jnfd alnu vdxi bpla";
// 이메일 유효성 검증 함수
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}
exports.sendMail = functions.https.onRequest(async (req, res) => {
    // CORS 헤더 수동 설정
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Preflight OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    const { to, subject, html, attachments: attachmentsInput } = req.body;
    if (!to || typeof to !== "string") {
        res.status(400).json({ success: false, error: "Recipient email address (to) must be a string." });
        return;
    }
    if (!isValidEmail(to)) {
        res.status(400).json({ success: false, error: `"${to}" is not a valid email address.` });
        return;
    }
    if (!subject || !html) {
        res.status(400).json({ success: false, error: "Fields 'subject' and 'html' are required." });
        return;
    }
    console.log(`Attempting to send email to:`, to);
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: gmailUser,
                pass: gmailPass
            }
        });
        const mailOptions = {
            from: `"Audionyx" <${gmailUser}>`,
            to: to,
            subject,
            html,
            text: html.replace(/<[^>]*>/g, ""),
        };
        if (attachmentsInput && Array.isArray(attachmentsInput) && attachmentsInput.length > 0) {
            mailOptions.attachments = attachmentsInput.map((att) => ({
                filename: att.filename,
                content: att.content,
                encoding: "base64",
                contentType: att.contentType || undefined,
            }));
        }
        await transporter.sendMail(mailOptions);
        res.status(200).json({
            success: true,
            sentTo: [to],
            count: 1
        });
    }
    catch (error) {
        console.error("Error sending email:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        res.status(500).json({ success: false, error: `Failed to send email: ${errorMessage}` });
    }
});
//# sourceMappingURL=sendMail.js.map