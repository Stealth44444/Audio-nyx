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
exports.sendMailHttp = void 0;
const functions = __importStar(require("firebase-functions"));
const nodemailer = __importStar(require("nodemailer"));
// 하드코딩된 Gmail 설정 (테스트용)
const gmailUser = "audionyx369@gmail.com";
const gmailPass = "jnfd alnu vdxi bpla";
exports.sendMailHttp = functions.https.onRequest(async (req, res) => {
    // CORS 허용
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(200).send('');
        return;
    }
    try {
        const { to, subject, html } = req.body;
        // 기본값 설정
        const emailTo = to || "audionyx369@gmail.com";
        const emailSubject = subject || "Audionyx 테스트 메일";
        const emailHtml = html || "<h1>🎵 Audionyx 테스트</h1><p>HTTP 함수 테스트입니다!</p>";
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: gmailUser,
                pass: gmailPass
            }
        });
        await transporter.sendMail({
            from: `"Audionyx" <${gmailUser}>`,
            to: emailTo,
            subject: emailSubject,
            html: emailHtml,
            text: emailHtml.replace(/<[^>]*>/g, "")
        });
        res.status(200).json({
            success: true,
            message: "메일 발송 성공!",
            to: emailTo,
            subject: emailSubject
        });
    }
    catch (error) {
        console.error("메일 발송 오류:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "알 수 없는 오류"
        });
    }
});
//# sourceMappingURL=sendMailHttp.js.map