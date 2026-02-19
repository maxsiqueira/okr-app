const fs = require('fs');

const secToHours = (sec) => Math.round((sec || 0) / 36) / 100;

function classifyArea(summary) {
    const s = summary.toLowerCase();
    if (s.includes('vm') || s.includes('oci') || s.includes('cloud') || s.includes('migração') || s.includes('rede') || s.includes('infra') || s.includes('backup') || s.includes('storage') || s.includes('openstreetmaps') || s.includes('mailgun') || s.includes('opensearch')) {
        return 'Infra';
    }
    if (s.includes('pipeline') || s.includes('ci') || s.includes('cd') || s.includes('teamcity') || s.includes('awx') || s.includes('deploy') || s.includes('build') || s.includes('ansible') || s.includes('automation') || s.includes('observability') || s.includes('monitoramento') || s.includes('logs') || s.includes('uptime') || s.includes('ssl')) {
        return 'DevOps';
    }
    if (s.includes('datalake') || s.includes('doris') || s.includes('arquitetura') || s.includes('design') || s.includes('plataforma') || s.includes('integração') || s.includes('api') || s.includes('service mesh')) {
        return 'Architecture';
    }
    return 'Uncertain';
}

function processReport() {
    const raw = JSON.parse(fs.readFileSync('raw_epic_data_v2.json', 'utf8'));
    const data = raw.result;

    if (!data || data.status !== 'success') {
        console.error("Failed to fetch data correctly");
        process.exit(1);
    }

    const children = data.children || [];
    const reportData = [];
    const missingTime = [];

    const personHours = {};
    const statusHours = {};
    const areaHours = { 'Infra': 0, 'DevOps': 0, 'Architecture': 0, 'Uncertain': 0 };
    const monthlyHours = {};

    children.forEach(issue => {
        const fields = issue.fields;
        const key = issue.key;
        const summary = fields.summary;
        const status = fields.status.name;
        const assignee = fields.assignee ? fields.assignee.displayName : 'Unassigned';
        const created = fields.created;
        const resolved = fields.resolutiondate || null;
        const timeSpentSec = fields.aggregatetimespent || fields.timespent || 0;
        const hours = secToHours(timeSpentSec);
        const area = classifyArea(summary);

        if (timeSpentSec === 0) {
            missingTime.push({ key, summary, status, assignee });
        } else {
            reportData.push({
                key, summary, status, assignee, created, resolved, timeSpentSec, hours, area
            });

            // Person
            personHours[assignee] = (personHours[assignee] || 0) + hours;

            // Status
            statusHours[status] = (statusHours[status] || 0) + hours;

            // Area
            areaHours[area] = (areaHours[area] || 0) + hours;

            // Monthly (2025)
            const dateToUse = resolved || created;
            if (dateToUse.startsWith('2025')) {
                const month = dateToUse.substring(0, 7);
                monthlyHours[month] = (monthlyHours[month] || 0) + hours;
            }
        }
    });

    // Total Overall
    const totalHours = Object.values(areaHours).reduce((a, b) => a + b, 0);

    // Summary Bullets
    console.log("## OKR Report: DEVOPS-633\n");
    console.log("### 1. Summary");
    console.log(`- **Total Effort**: ${totalHours.toFixed(2)} hours logged.`);
    console.log(`- **Core Areas**: DevOps (${((areaHours['DevOps'] / totalHours) * 100).toFixed(1)}%), Architecture (${((areaHours['Architecture'] / totalHours) * 100).toFixed(1)}%), Infra (${((areaHours['Infra'] / totalHours) * 100).toFixed(1)}%).`);
    const topPerson = Object.entries(personHours).sort((a, b) => b[1] - a[1])[0];
    console.log(`- **Top Contributor**: ${topPerson[0]} with ${topPerson[1].toFixed(2)} hours.`);
    console.log(`- **Data Quality**: ${missingTime.length} issues have no worklog logged.\n`);

    // Table 1
    console.log("### 2. Table 1 – Per-issue breakdown");
    console.log("| Key | Summary | Status | Assignee | Created | Resolved | Time Spent (s) | Hours | Area |");
    console.log("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
    reportData.forEach(r => {
        console.log(`| ${r.key} | ${r.summary} | ${r.status} | ${r.assignee} | ${r.created.substring(0, 10)} | ${r.resolved ? r.resolved.substring(0, 10) : '-'} | ${r.timeSpentSec} | ${r.hours.toFixed(2)} | ${r.area} |`);
    });
    console.log("\n");

    // Table 2
    console.log("### 3. Table 2 – Hours per person");
    console.log("| Assignee | Total Hours |");
    console.log("| :--- | :--- |");
    Object.entries(personHours).sort((a, b) => b[1] - a[1]).forEach(([name, hr]) => {
        console.log(`| ${name} | ${hr.toFixed(2)} |`);
    });
    console.log("\n");

    // Table 3
    console.log("### 4. Table 3 – Hours per status");
    console.log("| Status | Total Hours |");
    console.log("| :--- | :--- |");
    Object.entries(statusHours).sort((a, b) => b[1] - a[1]).forEach(([st, hr]) => {
        console.log(`| ${st} | ${hr.toFixed(2)} |`);
    });
    console.log("\n");

    // Table 4
    console.log("### 5. Table 4 – Hours per OKR area");
    console.log("| Area | Total Hours | % |");
    console.log("| :--- | :--- | :--- |");
    Object.entries(areaHours).forEach(([area, hr]) => {
        console.log(`| ${area} | ${hr.toFixed(2)} | ${((hr / totalHours) * 100).toFixed(1)}% |`);
    });
    console.log("\n");

    // Table 5
    console.log("### 6. Table 5 – Hours per month (2025)");
    console.log("| Month (YYYY-MM) | Total Hours | Note |");
    console.log("| :--- | :--- | :--- |");
    Object.keys(monthlyHours).sort().forEach(m => {
        console.log(`| ${m} | ${monthlyHours[m].toFixed(2)} | Resolved or Created (Approx) |`);
    });
    console.log("\n");

    // Table 6
    console.log("### 7. Table 6 – Issues with missing Tempo Gasto");
    console.log("| Key | Summary | Status | Assignee | Note |");
    console.log("| :--- | :--- | :--- | :--- | :--- |");
    missingTime.forEach(m => {
        console.log(`| ${m.key} | ${m.summary} | ${m.status} | ${m.assignee} | No worklog logged |`);
    });
}

processReport();
