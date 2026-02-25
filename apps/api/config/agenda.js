import Agenda from 'agenda';

let agenda;

export function getAgenda() {
  return agenda;
}

export async function createAgenda() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:pa_mongo_pass@localhost:27017/agenda?authSource=admin';

  agenda = new Agenda({
    db: {
      address: mongoUri,
      collection: 'agendaJobs',
      options: { useNewUrlParser: true, useUnifiedTopology: true },
    },
    processEvery: '1 minute',
    maxConcurrency: 10,
  });

  agenda.on('error', (err) => {
    console.error('Agenda MongoDB connection error:', err);
  });

  return agenda;
}
