import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(request) {
  const { user, error } = verifyAuth(request);
  if (error) return error;

  const roleKey = 'operasional';

  const ledger = await prisma.operationalSaldoLedger.findMany({
    where: { roleKey },
    orderBy: { createdAt: 'desc' },
  });

  let balance = 0;
  for (const tx of ledger) {
    balance += (tx.type === 'RESTCOJH' || tx.type === 'DECUMS') ? tx.amount : -tx.amount;
  }

  const history = ledger.map((item) => ({
    id: item.id,
    type: item.type,
    amount: item.amount,
    balance: item.balance,
    createdAt: item.createdAt,
    description: item.description,
  }));

  return Response.json({ balance, history });
}
