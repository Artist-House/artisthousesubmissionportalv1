import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_ACCESS_REQUEST_TO = "brandon@artisthouse.world,digitalops@artisthouse.world";
const DEFAULT_ACCESS_REQUEST_FROM = "Artist House Portal <onboarding@resend.dev>";
const NOTION_ALLOWLIST_URL =
  "https://app.notion.com/p/37944d10b4ab80058725f5458b74c3ac?v=37944d10b4ab8038ac93000c8563332e";

function getRecipients() {
  return (process.env.ACCESS_REQUEST_TO || DEFAULT_ACCESS_REQUEST_TO)
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

// Sends to each recipient separately: Resend rejects an entire request if any
// one recipient is not deliverable (e.g. sandbox mode only allows the account
// owner's address), and one bad recipient must not block the others.
async function sendToTeam({ subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set. Skipping email:", subject);
    return false;
  }

  const from = process.env.ACCESS_REQUEST_FROM || DEFAULT_ACCESS_REQUEST_FROM;

  const results = await Promise.all(
    getRecipients().map(async (recipient) => {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject,
          text
        })
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`Failed to send "${subject}" to ${recipient}:`, response.status, body);
        return false;
      }

      console.log(`Email "${subject}" sent to ${recipient}`);
      return true;
    })
  );

  return results.some(Boolean);
}

export async function sendAccessRequestEmail({ email, name }) {
  const displayName = name ? `${name} (${email})` : email;

  return sendToTeam({
    subject: `Portal access request: ${email}`,
    text: `${displayName} needs access to the Artist House submission portal.\n\nTo grant access, add ${email} to the Notion allowlist:\n${NOTION_ALLOWLIST_URL}`
  });
}

export async function sendSubmissionNotificationEmail({
  action,
  submitterEmail,
  submitterName,
  title,
  releaseType,
  kindLabel = "",
  changes = [],
  uploadedFiles = [],
  missingFields = []
}) {
  const displayName = submitterName ? `${submitterName} (${submitterEmail})` : submitterEmail;
  const releaseLabel = kindLabel || (releaseType === "single" ? "Single" : "Album / EP");
  const verb = action === "update" ? "updated" : "submitted";

  const lines = [`${displayName} ${verb} the ${releaseLabel} "${title}" in the Artist House portal.`];

  if (changes.length) {
    lines.push("");
    lines.push(action === "update" ? "What changed:" : "Submitted information:");

    for (const change of changes) {
      if (action === "update" && change.before) {
        lines.push(`- ${change.label}: "${change.before}" -> "${change.after || "(cleared)"}"`);
      } else {
        lines.push(`- ${change.label}: ${change.after}`);
      }
    }
  }

  if (uploadedFiles.length) {
    lines.push("");
    lines.push(`Files attached: ${uploadedFiles.join(", ")}`);
  }

  if (missingFields.length) {
    lines.push("");
    lines.push(`Still missing: ${missingFields.join(", ")}`);
  }

  return sendToTeam({
    subject: `Portal ${action === "update" ? "update" : "submission"}: ${title} (${submitterEmail})`,
    text: lines.join("\n")
  });
}
