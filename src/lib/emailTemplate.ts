/**
 * [UI_OVERHAUL] Shell de template de e-mail com a identidade visual da
 * UNICAP (bordô #6B1426 + dourado #C89D3C). Puro (sem I/O) e seguro
 * para clientes de e-mail: layout em tabelas e estilos inline.
 *
 * Usado por src/lib/passwordReset.ts (recuperação de senha) e por
 * src/lib/emailNotify.ts (notificação de etapa) para garantir consistência
 * de marca em todos os e-mails transacionais.
 */

/** Escapa valores do usuário no HTML (nomes/vagas com < ou &). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND = {
  primary: "#6B1426",
  primaryHover: "#520F1D",
  secondary: "#C89D3C",
  ink: "#1E293B",
  muted: "#64748B",
  surface: "#F8F9FA",
  border: "#E2E8F0",
} as const;

export type BrandCta = { label: string; url: string };

type BrandedEmailArgs = {
  preheader: string;
  heading: string;
  /** Já escapado pelo chamador (usa escapeHtml para valores do usuário). */
  bodyHtml: string;
  cta?: BrandCta;
  footerNote?: string;
};

/**
 * Documento de e-mail completo com cabeçalho de marca, cartão de conteúdo,
 * CTA opcional (botão bordô) e rodapé. Estilos inline + tabelas = render
 * consistente em Gmail, Outlook, Apple Mail, etc.
 */
export function renderBrandedEmail(args: BrandedEmailArgs): string {
  const ctaHtml = args.cta ? renderCta(args.cta) : "";
  const footerNote = args.footerNote
    ? `<p style="margin:0 0 8px;color:${BRAND.muted};font-size:12px;line-height:18px;">${args.footerNote}</p>`
    : "";

  return [
    "<!DOCTYPE html>",
    '<html lang="pt-BR">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<meta name="color-scheme" content="light" />`,
    `<title>${escapeHtml(args.heading)}</title>`,
    "</head>",
    `<body style="margin:0;padding:0;background-color:${BRAND.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">`,
    // Preheader invisível (texto de pré-visualização no inbox)
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(args.preheader)}</div>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:' +
      BRAND.surface +
      ';">',
    '<tr><td align="center" style="padding:32px 16px;">',
    '<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background-color:#FFFFFF;border-radius:16px;border:1px solid ' +
      BRAND.border +
      ';overflow:hidden;">',
    // Cabeçalho de marca
    `<tr><td style="background-color:${BRAND.primary};padding:24px 32px;">`,
    `<div style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">UNICAP</div>`,
    `<div style="margin-top:2px;font-size:13px;color:${BRAND.secondary};font-weight:600;">Portal de Carreiras</div>`,
    "</td></tr>",
    // Barra dourada
    `<tr><td style="height:4px;background:linear-gradient(90deg,${BRAND.secondary},${BRAND.primaryHover});font-size:0;line-height:0;">&nbsp;</td></tr>`,
    // Conteúdo
    `<tr><td style="padding:32px;">`,
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:${BRAND.ink};font-weight:700;">${escapeHtml(args.heading)}</h1>`,
    args.bodyHtml,
    ctaHtml,
    "</td></tr>",
    // Rodapé
    `<tr><td style="padding:20px 32px;background-color:${BRAND.surface};border-top:1px solid ${BRAND.border};">`,
    footerNote,
    `<p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:18px;">© ${new Date().getFullYear()} Universidade Católica do Paraná (UNICAP) — Portal de Carreiras.</p>`,
    "</td></tr>",
    "</table>",
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}

/** Botão CTA em tabela (compatível com Outlook) e estilo inline. */
function renderCta(cta: BrandCta): string {
  const url = escapeHtml(cta.url);
  return [
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px;">`,
    `<tr><td style="border-radius:8px;background-color:${BRAND.primary};">`,
    `<a href="${url}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;background-color:${BRAND.primary};">${escapeHtml(cta.label)}</a>`,
    "</td></tr>",
    "</table>",
  ].join("");
}
