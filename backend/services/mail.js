const sgMail = require('@sendgrid/mail');

const FROM = process.env.MAIL_FROM;
const configured = Boolean(process.env.SENDGRID_API_KEY && FROM);

if (configured) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function isConfigured() {
  return configured;
}

async function send({ to, subject, text, html }) {
  if (!configured) {
    throw new Error('Pošiljanje e-pošte ni nastavljeno (manjka SENDGRID_API_KEY ali MAIL_FROM).');
  }
  await sgMail.send({ to, from: FROM, subject, text, html });
}

function resetPasswordMail({ name, url }) {
  return {
    subject: 'Ponastavitev gesla za Snovko',
    text: [
      `Pozdravljeni, ${name}.`,
      '',
      'Prejeli smo zahtevo za ponastavitev gesla. Novo geslo nastavite na tej povezavi:',
      url,
      '',
      'Povezava velja eno uro in jo je mogoče uporabiti samo enkrat.',
      'Če ponastavitve niste zahtevali, to sporočilo prezrite — geslo ostane nespremenjeno.',
      '',
      'Snovko',
    ].join('\n'),
    html: `
      <p>Pozdravljeni, ${name}.</p>
      <p>Prejeli smo zahtevo za ponastavitev gesla. Novo geslo nastavite na tej povezavi:</p>
      <p><a href="${url}">Nastavi novo geslo</a></p>
      <p>Povezava velja eno uro in jo je mogoče uporabiti samo enkrat.</p>
      <p>Če ponastavitve niste zahtevali, to sporočilo prezrite — geslo ostane nespremenjeno.</p>
      <p>Snovko</p>
    `,
  };
}

module.exports = { isConfigured, send, resetPasswordMail };
