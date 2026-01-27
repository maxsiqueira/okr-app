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
