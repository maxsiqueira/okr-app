const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.post("/", async (req, res) => {
    try {
        const { url, method, headers, body } = req.body;

        if (!url) {
            return res.status(400).json({ error: "Missing target URL" });
        }

        const fetchOptions = {
            method: method || "GET",
            headers: headers || {},
            body: body ? JSON.stringify(body) : undefined,
        };

        const response = await fetch(url, fetchOptions);
        const data = await response.text();

        res.status(response.status);

        // Pass relevant headers back
        const contentType = response.headers.get("content-type");
        if (contentType) res.setHeader("Content-Type", contentType);

        try {
            const json = JSON.parse(data);
            res.json(json);
        } catch (e) {
            res.send(data);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

exports.proxy = functions.https.onRequest(app);

exports.createUser = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to create users.');
    }

    // TODO: Check if the caller is an admin by querying Firestore
    // const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    // if (callerDoc.data().role !== 'admin') {
    //    throw new functions.https.HttpsError('permission-denied', 'Only admins can create users.');
    // }

    const { email, password, displayName, role, allowedPanels } = data;

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
        });

        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            displayName,
            role: role || 'user',
            allowedPanels: allowedPanels || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, uid: userRecord.uid };
    } catch (error) {
        console.error("Error creating user:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.sendEmail = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send emails.');
    }

    const { to, subject, text, html } = data;
    const nodemailer = require("nodemailer");

    try {
        // Fetch SMTP config from Firestore
        const configDoc = await admin.firestore().collection('config').doc('smtp').get();

        if (!configDoc.exists) {
            throw new Error("SMTP configuration not found in Firestore.");
        }

        const smtpConfig = configDoc.data();

        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: parseInt(smtpConfig.port),
            secure: smtpConfig.port === '465', // true for 465, false for other ports
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.password,
            },
        });

        const mailOptions = {
            from: `"${smtpConfig.fromName || 'Ion Dashboard'}" <${smtpConfig.fromEmail || smtpConfig.user}>`,
            to,
            subject,
            text,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.messageId);

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
