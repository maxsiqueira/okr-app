import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export interface EmailData {
    to: string;
    subject: string;
    text: string;
    html: string;
}

export const EmailService = {
    sendEmail: async (data: EmailData) => {
        const sendEmailFn = httpsCallable(functions, 'sendEmail');
        try {
            const result = await sendEmailFn(data);
            return result.data;
        } catch (error) {
            console.error("Error calling sendEmail function:", error);
            throw error;
        }
    }
};
