import nodemailer from 'nodemailer';

interface SendReportEmailParams {
    to: string[];
    pdfBuffer: Buffer;
    filename: string;
    clientName: string;
    assessmentType: string;
    maturityLevel: number | null;
    overallScore: number | null;
    extraMessage?: string;
}

function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: false, // TLS via STARTTLS
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

const MATURITY_LABELS: Record<number, string> = {
    1: 'Experimental', 2: 'Emergente', 3: 'Definido', 4: 'Gestionado', 5: 'Optimizado',
};

export async function sendReportEmail({
    to,
    pdfBuffer,
    filename,
    clientName,
    assessmentType,
    maturityLevel,
    overallScore,
    extraMessage,
}: SendReportEmailParams): Promise<void> {
    const from = process.env.SMTP_FROM ?? 'GammIA · Gamma Ingenieros <evaluaciones@gammaingenieros.com>';
    const maturityLabel = maturityLevel ? (MATURITY_LABELS[maturityLevel] ?? `Nivel ${maturityLevel}`) : 'N/A';
    const scoreText = overallScore != null ? overallScore.toFixed(2) : 'N/A';
    const typeLabel = assessmentType === 'EXPRESS' ? 'Express' : 'Avanzado';

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1e3a8a;padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">
              GAMMA INGENIEROS
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#93c5fd;letter-spacing:1px;text-transform:uppercase;">
              GammIA · Assessment de IA
            </p>
          </td>
        </tr>
        <!-- Gold bar -->
        <tr><td style="height:3px;background:#c9a84c;"></td></tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:14px;color:#475569;">Estimado(a),</p>
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
              Adjunto encontrará el <strong>Informe Ejecutivo de Madurez en IA</strong> correspondiente a la evaluación
              <strong>${typeLabel}</strong> de <strong>${clientName}</strong>.
            </p>

            <!-- Score box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#1e3a8a;text-transform:uppercase;letter-spacing:1px;">
                    Resumen de Resultados
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#475569;">
                        <strong style="color:#1e293b;">Score General:</strong> ${scoreText} / 4.0
                      </td>
                      <td style="padding:4px 0;font-size:13px;color:#475569;text-align:right;">
                        <strong style="color:#1e293b;">Madurez:</strong> ${maturityLabel}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${extraMessage ? `
            <div style="background:#f8faff;border-left:3px solid #3b82f6;border-radius:4px;padding:12px 16px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">${extraMessage.replace(/\n/g, '<br>')}</p>
            </div>` : ''}

            <p style="margin:0 0 8px;font-size:13px;color:#475569;line-height:1.6;">
              El informe adjunto contiene el análisis detallado por pilar, el plan de mejora priorizado
              y los comparativos frente a los marcos <strong>NIST AI RMF</strong> y <strong>MITRE ATLAS</strong>.
            </p>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
              Para cualquier consulta, no dude en contactarnos.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f0f4f8;border-top:1px solid #e2e8f0;padding:16px 32px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
              Gamma Ingenieros S.A.S · GammIA Assessment Platform · Clasificación: Confidencial
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const transporter = createTransporter();
    await transporter.sendMail({
        from,
        to: to.join(', '),
        subject: `Informe de Madurez en IA — ${clientName} (${typeLabel})`,
        html,
        attachments: [
            {
                filename,
                content: pdfBuffer,
                contentType: 'application/pdf',
            },
        ],
    });
}
