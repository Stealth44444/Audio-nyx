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
exports.sendMail = functions.https.onCall(async (data, context) => {
    // 임시로 모든 검증 비활성화 (테스트용)
    var _a;
    // 디버깅: 받은 데이터 구조 로깅 (순환 참조 방지)
    console.log("data의 타입:", typeof data);
    console.log("data의 키들:", Object.keys(data || {}));
    console.log("data.to:", data === null || data === void 0 ? void 0 : data.to);
    console.log("data.data?.to:", (_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.to);
    // data.data가 있다면 그 구조 확인
    if (data === null || data === void 0 ? void 0 : data.data) {
        console.log("data.data의 키들:", Object.keys(data.data));
        console.log("data.data.to:", data.data.to);
        console.log("data.data.subject:", data.data.subject);
    }
    // 실제 데이터는 data.data 안에 있음
    const actualData = (data === null || data === void 0 ? void 0 : data.data) || data;
    const to = (actualData === null || actualData === void 0 ? void 0 : actualData.to) || "test@example.com";
    const subject = (actualData === null || actualData === void 0 ? void 0 : actualData.subject) || "Test Subject";
    const html = (actualData === null || actualData === void 0 ? void 0 : actualData.html) || "<h1>Test HTML</h1><p>This is a test email.</p>";
    console.log("최종 추출된 값들:", { to, subject: subject.substring(0, 50) + "..." });
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: gmailUser,
                pass: gmailPass
            }
        });
        await transporter.sendMail({
            from: `"Audionyx" <${gmailUser}>`,
            to,
            subject,
            html,
            text: html.replace(/<[^>]*>/g, "") // 아주 간단한 HTML→텍스트 변환
        });
        return { ok: true };
    }
    catch (error) {
        console.error("메일 발송 오류:", error);
        throw new functions.https.HttpsError("internal", "메일 발송 실패");
    }
});
//# sourceMappingURL=sendMail.js.map