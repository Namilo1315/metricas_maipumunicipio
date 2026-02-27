// ======= CONFIG CLOUDINARY =======
const CLOUD_NAME    = "dvl8ryfpx";
const UPLOAD_PRESET = "unsigned_crm";
// ================================

const $ = (s) => document.querySelector(s);
const statusEl  = $("#status");
const resultEl  = $("#resultHtml");
const previewEl = $("#preview");

/* ------------ UI helpers ------------ */

function setStatus(msg, type = "") {
  statusEl.textContent = msg || "";
  statusEl.className =
    type === "error" ? "err" :
    type === "ok"    ? "ok"  :
    "muted";
}

function setPreview(html) {
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  previewEl.src = url;
}

function showCfgWarning() {
  const warn = $("#cfgWarn");
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    warn.style.display = "block";
    warn.innerHTML = "⚠️ Configurá CLOUD_NAME y UPLOAD_PRESET en <code>app.js</code>.";
  } else {
    warn.style.display = "none";
  }
}

// Optimización Cloudinary: 600px, formato/calidad auto
function optimize(url) {
  return url.replace("/upload/", "/upload/f_auto,q_auto,c_scale,w_600/");
}

/* ------------ Cloudinary upload ------------ */

async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUD_NAME)}/image/upload`;
  const form = new FormData();
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("file", file);

  const resp = await fetch(url, { method: "POST", body: form });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error("Error Cloudinary: " + t);
  }
  const data = await resp.json();
  return data.secure_url || data.url;
}

/* ------------ Build HTML email ------------ */
/**
 * Reglas:
 * - Si hay Header + Cuerpo + Footer → se usan en ese orden.
 * - Si SOLO hay Cuerpo → se arma solo con esa imagen centrada.
 * - Si hay Header y Cuerpo, o Cuerpo y Footer → se usan los disponibles.
 * - bodyLink se aplica SOLO a las imágenes de cuerpo.
 */
function buildEmailHTML(headerUrl, cuerpoUrl, footerUrl, bodyLink) {
  const rows = [];

  // Header
  if (headerUrl) {
    rows.push(
      '        <tr><td align="center">',
      `          <img src="${headerUrl}" alt="Header Municipalidad" style="display:block; width:100%; max-width:600px; height:auto; border:0; outline:0;">`,
      "        </td></tr>"
    );
  }

  // Cuerpo (obligatorio en al menos uno de los escenarios)
  if (cuerpoUrl) {
    const imgTag =
      `            <img src="${cuerpoUrl}" alt="Maipú crece en obras" ` +
      'style="display:block; width:100%; max-width:600px; height:auto; border:0; outline:0;">';

    rows.push(
      "        <tr><td align=\"center\">",
      bodyLink
        ? `          <a href="${bodyLink}" target="_blank" style="text-decoration:none; border:0; outline:0; display:inline-block;">`
        : "",
      imgTag,
      bodyLink ? "          </a>" : "",
      "        </td></tr>"
    );
  }

  // Footer
  if (footerUrl) {
    rows.push(
      '        <tr><td align="center">',
      `          <img src="${footerUrl}" alt="Footer Municipalidad" style="display:block; width:100%; max-width:600px; height:auto; border:0; outline:0;">`,
      "        </td></tr>"
    );
  }

  // Si por algún motivo solo vino header o solo footer sin cuerpo:
  if (!cuerpoUrl && !headerUrl && !footerUrl) {
    // No debería pasar porque validamos antes, pero por las dudas:
    rows.push(
      "        <tr><td align=\"center\" style=\"font-family:Arial, sans-serif; font-size:14px; color:#111827; padding:20px;\">",
      "          (Sin imágenes disponibles)",
      "        </td></tr>"
    );
  }

  return [
    "<!DOCTYPE html>",
    '<html lang="es">',
    "<head>",
    '  <meta charset="UTF-8">',
    "  <title>Maipú crece en obras</title>",
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "</head>",
    '<body style="margin:0; padding:0; background-color:#ffffff;">',
    '  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">',
    '    <tr><td align="center">',
    '      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; border-collapse:collapse; background-color:#ffffff;">',
            rows.join("\n"),
    "      </table>",
    "    </td></tr>",
    "  </table>",
    "</body>",
    "</html>"
  ].join("\n");
}

/* ------------ Eventos botones ------------ */

$("#btnReset").addEventListener("click", () => {
  resultEl.value = "";
  setStatus("", "muted");
  setPreview(
    "<!doctype html><title>Vista previa</title>" +
    "<p style='font:14px system-ui;padding:16px;color:#65738a'>" +
    "Subí una imagen (solo cuerpo) o Header+Cuerpo+Footer y generá el HTML para verlo acá." +
    "</p>"
  );
});

$("#btnCopiar").addEventListener("click", async () => {
  const html = resultEl.value.trim();
  if (!html) return;
  try {
    await navigator.clipboard.writeText(html);
    setStatus("HTML copiado ✅", "ok");
  } catch {
    setStatus("No se pudo copiar automáticamente.", "error");
  }
});

$("#btnDescargar").addEventListener("click", () => {
  const html = resultEl.value.trim();
  if (!html) {
    setStatus("No hay HTML para descargar.", "error");
    return;
  }
  const rawName  = $("#fileName").value || "maipu-mail.html";
  const fileName = rawName.replace(/[\\/:*?"<>|]+/g, "_");
  const blob     = new Blob([html], { type: "text/html;charset=utf-8" });
  const url      = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  setStatus(`Descargado: ${fileName}`, "ok");
});

$("#btnGenerar").addEventListener("click", async () => {
  const headerFile = $("#headerFile").files[0] || null;
  const cuerpoFile = $("#cuerpoFile").files[0] || null;
  const footerFile = $("#footerFile").files[0] || null;
  const bodyLink   = $("#bodyLink").value.trim();

  // Reglas:
  // - Si hay solo 1 imagen (por ej. cuerpo) → ok.
  // - Si hay varias (header/cuerpo/footer) → se usan las que existan.
  if (!headerFile && !cuerpoFile && !footerFile) {
    setStatus("Subí al menos una imagen (recomendado: Cuerpo).", "error");
    return;
  }

  // Para respetar tu flujo: si no hay header/footer,
  // la idea es que uses Cuerpo como pieza completa.
  if (!cuerpoFile && (headerFile || footerFile)) {
    // Permitimos igual: arma mail con header/footer solamente.
    setStatus("Generando solo con Header/Footer (sin cuerpo).", "muted");
  }

  try {
    setStatus("Subiendo imágenes a Cloudinary…", "muted");

    const uploads = [];

    if (headerFile) uploads.push(uploadToCloudinary(headerFile));
    else uploads.push(Promise.resolve(null));

    if (cuerpoFile) uploads.push(uploadToCloudinary(cuerpoFile));
    else uploads.push(Promise.resolve(null));

    if (footerFile) uploads.push(uploadToCloudinary(footerFile));
    else uploads.push(Promise.resolve(null));

    const [hUrlRaw, cUrlRaw, fUrlRaw] = await Promise.all(uploads);

    const headerUrl = hUrlRaw ? optimize(hUrlRaw) : null;
    const cuerpoUrl = cUrlRaw ? optimize(cUrlRaw) : null;
    const footerUrl = fUrlRaw ? optimize(fUrlRaw) : null;

    const html = buildEmailHTML(headerUrl, cuerpoUrl, footerUrl, bodyLink);

    resultEl.value = html;
    setPreview(html);
    setStatus("HTML generado ✅ (URLs públicas listo para CRM)", "ok");
  } catch (e) {
    console.error(e);
    setStatus(e.message || "Error subiendo imágenes", "error");
  }
});

/* ------------ Init ------------ */

showCfgWarning();
setPreview(
  "<!doctype html><title>Vista previa</title>" +
  "<p style='font:14px system-ui;padding:16px;color:#65738a'>" +
  "Aca se veran las img subidas en formato html." +
  "</p>"
);
