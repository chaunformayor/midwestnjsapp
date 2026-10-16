// Local SMTP server for testing. Requires login (like a real provider) and
// forwards each message to the mock's state so the browser test can read it.
import { SMTPServer } from 'smtp-server'
import { simpleParser } from 'mailparser'
const server = new SMTPServer({
  authOptional: false,
  disabledCommands: ['STARTTLS'],
  onAuth(auth, _s, cb) {
    if (auth.username === 'smtp-user' && auth.password === 'smtp-pass') return cb(null, { user: auth.username })
    cb(new Error('Invalid username or password'))
  },
  onData(stream, session, cb) {
    simpleParser(stream).then(async (m) => {
      await fetch('http://127.0.0.1:8899/__mock/smtp', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: (m.to?.value ?? []).map((x) => x.address), from: m.from?.text, replyTo: m.replyTo?.text, subject: m.subject, html: m.html || '' }) })
      cb()
    }).catch(cb)
  },
})
server.listen(2525, '127.0.0.1', () => console.log('smtp sink on 2525'))
