export async function onRequestGet({ params, env }) {
  const id = params.id;
  const rec = await env.BOOKING_KV.get(`bookingById:${id}`, { type: 'json' });
  if (!rec) return new Response('Not found', { status: 404 });
  const { date, time, name, email, title } = rec;

  const minutes = parseInt(env.SLOT_MINUTES || '30', 10);
  const { startLocal, endLocal } = localDateTimeRange(date, time, minutes);

  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//PermitPulse//Booking//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nBEGIN:VEVENT\nUID:${id}@permitpulse\nDTSTAMP:${ts(new Date())}\nDTSTART:${startLocal}\nDTEND:${endLocal}\nSUMMARY:${escapeICS(title || 'PermitPulse — Intro Call')}\nDESCRIPTION:${escapeICS('Booked via PermitPulse' + (name?` for ${name}`:''))}\nORGANIZER;CN=PermitPulse:MAILTO:hello@getpermitpulse.com\nATTENDEE;CN=${escapeICS(name||'Client')};PARTSTAT=ACCEPTED:MAILTO:${email||'client@example.com'}\nEND:VEVENT\nEND:VCALENDAR\n`;

  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename=permitpulse-${date}-${time}.ics`
    }
  });
}

function ts(d){ return d.toISOString().replace(/[-:]/g,'').replace(/\..+/, 'Z'); }
function escapeICS(s){ return String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
function localDateTimeRange(dateStr, timeStr, minutes) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const [hh,mm] = timeStr.split(':').map(Number);
  const pad = n => String(n).padStart(2,'0');
  const startLocal = `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
  const endDate = new Date(y, m-1, d, hh, mm + minutes, 0);
  const endLocal = `${endDate.getFullYear()}${pad(endDate.getMonth()+1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
  return { startLocal, endLocal };
}
