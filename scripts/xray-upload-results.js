const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../src/config/xray.env') });

const DEFAULT_AUTH_URL = 'https://xray.cloud.getxray.app/api/v2/authenticate';

const reportPath = path.join(__dirname, '../reports/cucumber-json/cucumber-report.json');
const htmlReportPath = path.join(__dirname, '../reports/html/cucumber-report.html');

const JIRA_ISSUE_KEY_TAG = /^@[A-Z][A-Z0-9_]*-\d+$/i;

function apiBaseFromAuthUrl(authUrl) {
  const u = authUrl.trim();
  return u.replace(/\/authenticate\/?$/i, '') || 'https://xray.cloud.getxray.app/api/v2';
}

function normalizeExecTag(key) {
  const k = String(key).trim();
  if (!k) return '';
  return k.startsWith('@') ? k : `@${k}`;
}

function injectTestExecutionTag(report, execTag) {
  if (!execTag || !Array.isArray(report)) return report;
  for (const feature of report) {
    if (!feature.elements || !Array.isArray(feature.elements)) continue;
    for (const scenario of feature.elements) {
      if (!scenario.tags) scenario.tags = [];
      if (scenario.tags.some((t) => t && t.name === execTag)) continue;
      scenario.tags.push({ name: execTag, line: scenario.line || 1 });
    }
  }
  return report;
}

function testIssueKeyTagsOnScenario(scenario, execTagNorm) {
  const names = (scenario.tags || []).map((t) => (t && t.name ? String(t.name) : ''));
  return names.filter((n) => JIRA_ISSUE_KEY_TAG.test(n) && n !== execTagNorm);
}

function filterToXrayMappedScenarios(report, execTagNorm) {
  const skipped = [];
  const out = [];
  for (const feature of report || []) {
    const kept = [];
    for (const el of feature.elements || []) {
      if (testIssueKeyTagsOnScenario(el, execTagNorm).length > 0) {
        kept.push(el);
      } else {
        skipped.push({
          feature: feature.uri || feature.name || '(feature)',
          scenario: el.name || '(scenario)',
        });
      }
    }
    if (kept.length === 0) continue;
    out.push({ ...feature, elements: kept });
  }
  return { report: out, skipped };
}

function assertHasMappableScenarios(report, skippedCount, execTagNorm) {
  let total = 0;
  for (const feature of report || []) {
    total += (feature.elements || []).length;
  }
  if (total === 0 && skippedCount === 0) {
    console.error('Cucumber JSON has no scenarios.');
    process.exit(1);
  }
  if (total > 0) return;

  console.error(
    `No scenarios mapped to a Test issue tag. Skipped ${skippedCount} (exec tag: ${execTagNorm || 'none'}).`,
  );
  process.exit(1);
}

async function authenticate(clientId, clientSecret, authUrl) {
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xray authenticate failed HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  let token = text.trim();
  try {
    token = JSON.parse(token);
  } catch {
    /* plain JWT string */
  }
  if (typeof token !== 'string' || !token) {
    throw new Error('Xray authenticate: unexpected response (expected JWT string)');
  }
  return token;
}

async function importCucumber(apiBase, token, reportBody, testExecIssueKey) {
  const url = new URL(`${apiBase}/import/execution/cucumber`);
  if (testExecIssueKey) {
    url.searchParams.set('testExecutionKey', testExecIssueKey);
  }
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: reportBody,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xray import failed HTTP ${res.status}: ${text.slice(0, 2000)}`);
  }
  return text;
}

const JIRA_PLACEHOLDER_MARKERS = [
  'your_atlassian_account_email',
  'your_jira_cloud_api_token',
  'your-domain.atlassian.net',
];

function normalizeJiraEmail(email) {
  let e = String(email).trim();
  if (e.toLowerCase().startsWith('mailto:')) {
    e = e.slice(7).trim();
  }
  return e;
}

function assertJiraCredentialsLookValid(email, apiToken) {
  const emailLower = email.toLowerCase();
  const tokenLower = apiToken.toLowerCase();
  const badEmail =
    !email.includes('@') ||
    JIRA_PLACEHOLDER_MARKERS.some((m) => emailLower.includes(m.toLowerCase()));
  const badToken =
    tokenLower.length < 20 ||
    JIRA_PLACEHOLDER_MARKERS.some((m) => tokenLower.includes(m.toLowerCase()));
  if (badEmail || badToken) {
    throw new Error(
      'Jira credentials look like placeholders. Set JIRA_EMAIL and JIRA_API_TOKEN to real Atlassian credentials.',
    );
  }
}

function jiraAuthHeader(email, apiToken) {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
}

async function jiraGet(jiraBaseUrl, apiPath, email, apiToken) {
  const url = `${jiraBaseUrl.replace(/\/$/, '')}${apiPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: jiraAuthHeader(email, apiToken),
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function assertJiraCanAccessIssue(jiraBaseUrl, issueRef, email, apiToken) {
  const apiPath = `/rest/api/3/issue/${encodeURIComponent(issueRef)}?fields=key,summary`;
  const { ok, status, text } = await jiraGet(jiraBaseUrl, apiPath, email, apiToken);
  if (status === 401 || status === 403) {
    throw new Error(
      `Jira API auth failed for ${issueRef} (HTTP ${status}). Check JIRA_EMAIL and JIRA_API_TOKEN.`,
    );
  }
  if (!ok) {
    throw new Error(`Jira API cannot read issue ${issueRef} (HTTP ${status}): ${text.slice(0, 500)}`);
  }
}

function parseIssueKeyFromXrayResponse(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    return parsed.key || (parsed.testExecIssue && parsed.testExecIssue.key) || '';
  } catch {
    return '';
  }
}

function parseIssueIdFromXrayResponse(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    return parsed.id || (parsed.testExecIssue && parsed.testExecIssue.id) || '';
  } catch {
    return '';
  }
}

async function attachFileToJiraIssue({ jiraBaseUrl, issueKey, email, apiToken, filePath }) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Jira attachment file not found: ${filePath}`);
  }

  const url = `${jiraBaseUrl.replace(/\/$/, '')}/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`;
  const fileName = path.basename(filePath);
  const fileBlob = new Blob([fs.readFileSync(filePath)], { type: 'text/html' });
  const form = new FormData();
  form.append('file', fileBlob, fileName);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: jiraAuthHeader(email, apiToken),
      'X-Atlassian-Token': 'no-check',
    },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Jira attachment failed HTTP ${res.status}: ${text.slice(0, 2000)}`);
    err.status = res.status;
    throw err;
  }
  return text;
}

function resolveHtmlAttachmentTargets(overrideKey, xrayResponseText, testExecKey) {
  const importedKey = parseIssueKeyFromXrayResponse(xrayResponseText);
  const importedId = parseIssueIdFromXrayResponse(xrayResponseText);
  const targets = [];
  if (importedKey) targets.push(importedKey);
  if (importedId && !targets.includes(importedId)) targets.push(importedId);
  if (overrideKey && !targets.includes(overrideKey)) targets.push(overrideKey);
  if (testExecKey && !targets.includes(testExecKey)) targets.push(testExecKey);
  return targets;
}

async function attachHtmlReportWithFallback({ jiraBaseUrl, email, apiToken, filePath, targets }) {
  let lastError;
  for (let i = 0; i < targets.length; i += 1) {
    const issueKey = targets[i];
    try {
      const text = await attachFileToJiraIssue({
        jiraBaseUrl,
        issueKey,
        email,
        apiToken,
        filePath,
      });
      return { issueKey, text };
    } catch (err) {
      lastError = err;
      const is404 = err.status === 404 || String(err.message).includes('HTTP 404');
      if (is404 && i < targets.length - 1) {
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('No Jira issue key available for HTML attachment.');
}

async function main() {
  const clientId = process.env.XRAY_CLIENT_ID || '';
  const secret = process.env.XRAY_CLIENT_SECRET || '';
  const authUrl = (process.env.XRAY_AUTH_URL || DEFAULT_AUTH_URL).trim();
  const apiBase = apiBaseFromAuthUrl(authUrl);
  const testExec = (process.env.XRAY_TEST_EXECUTION_KEY || '').trim();
  const dryRun = String(process.env.XRAY_DRY_RUN || '').toLowerCase() === 'true';
  const jiraBaseUrl = (process.env.JIRA_BASE_URL || '').trim();
  const attachHtmlReport = String(process.env.JIRA_ATTACH_HTML_REPORT || '').toLowerCase() === 'true';
  const jiraEmail = normalizeJiraEmail(process.env.JIRA_EMAIL || '');
  const jiraApiToken = (process.env.JIRA_API_TOKEN || '').trim();
  const attachmentIssueOverride = (process.env.JIRA_ATTACH_ISSUE_KEY || '').trim();

  if (!clientId || !secret) {
    console.error('Missing XRAY_CLIENT_ID or XRAY_CLIENT_SECRET.');
    process.exit(1);
  }
  if (!fs.existsSync(reportPath)) {
    console.error('Cucumber report not found. Run tests first.');
    process.exit(1);
  }

  const raw = fs.readFileSync(reportPath, 'utf8');
  let report;
  try {
    report = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid cucumber report JSON:', e.message);
    process.exit(1);
  }

  const execTag = testExec ? normalizeExecTag(testExec) : '';
  if (execTag) {
    injectTestExecutionTag(report, execTag);
  }

  const { report: filtered, skipped } = filterToXrayMappedScenarios(report, execTag);
  assertHasMappableScenarios(filtered, skipped.length, execTag);
  report = filtered;

  const body = JSON.stringify(report);

  if (dryRun) {
    process.exit(0);
  }

  const token = await authenticate(clientId, secret, authUrl);
  const responseText = await importCucumber(apiBase, token, body, testExec);

  if (attachHtmlReport) {
    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
      throw new Error(
        'JIRA_ATTACH_HTML_REPORT=true requires JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN.',
      );
    }
    assertJiraCredentialsLookValid(jiraEmail, jiraApiToken);
    const targets = resolveHtmlAttachmentTargets(attachmentIssueOverride, responseText, testExec);
    if (targets.length === 0) {
      throw new Error('Could not determine Jira issue key for HTML report attachment.');
    }
    await assertJiraCanAccessIssue(jiraBaseUrl, targets[0], jiraEmail, jiraApiToken);
    await attachHtmlReportWithFallback({
      jiraBaseUrl,
      email: jiraEmail,
      apiToken: jiraApiToken,
      filePath: htmlReportPath,
      targets,
    });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
