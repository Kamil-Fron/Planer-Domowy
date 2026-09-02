import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, Bill, BudgetLimit } from '../types';

export function exportTransactionsToCSV(transactions: Transaction[], selectedMonth?: string) {
  const filtered = selectedMonth
    ? transactions.filter((t) => t.date.startsWith(selectedMonth))
    : transactions;

  const headers = ['Typ', 'Data', 'Tytuł / Opis', 'Kategoria', 'Kwota (PLN)', 'Komentarz / Notatki', 'Sklep'];
  
  const rows = filtered.map((t) => [
    t.type === 'income' ? 'Przychód' : 'Wydatek',
    t.date,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    `"${(t.category || '').replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    `"${(t.comment || '').replace(/"/g, '""')}"`,
    `"${(t.receiptStoreName || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `raport_budzetowy_${selectedMonth || 'pelny'}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportBillsToCSV(bills: Bill[]) {
  const headers = ['Nazwa rachunku', 'Usługa', 'Dostawca', 'Kwota (PLN)', 'Termin płatności', 'Cykl', 'Status', 'Nr faktury', 'Notatki'];
  
  const rows = bills.map((b) => [
    `"${b.name.replace(/"/g, '""')}"`,
    b.serviceType,
    `"${(b.provider || '').replace(/"/g, '""')}"`,
    b.amount.toFixed(2),
    b.dueDate,
    b.billingCycle,
    b.status === 'paid' ? 'Opłacony' : b.status === 'overdue' ? 'Przeterminowany' : 'Oczekuje',
    `"${(b.invoiceNumber || '').replace(/"/g, '""')}"`,
    `"${(b.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `rachunki_domowe_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generatePDFReport(
  transactions: Transaction[],
  bills: Bill[],
  budgetLimits: BudgetLimit[],
  selectedMonth: string
) {
  const doc = new jsPDF();
  const currentMonthTransactions = transactions.filter((t) => t.date.startsWith(selectedMonth));
  
  const totalIncome = currentMonthTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const totalExpense = currentMonthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const balance = totalIncome - totalExpense;
  const pendingBills = bills.filter((b) => b.status !== 'paid');
  const pendingBillsTotal = pendingBills.reduce((s, b) => s + b.amount, 0);

  // Header Title
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('Raport Budzetu Domowego', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Okres: ${selectedMonth}  |  Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, 14, 30);

  // Summary Cards Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 35, 182, 30, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 35, 182, 30, 3, 3, 'S');

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('LACZNE DOCHODY', 22, 44);
  doc.text('LACZNE WYDATKI', 80, 44);
  doc.text('BILANS MIESIECZNY', 138, 44);

  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129); // green
  doc.text(`+${totalIncome.toFixed(2)} PLN`, 22, 55);

  doc.setTextColor(239, 68, 68); // red
  doc.text(`-${totalExpense.toFixed(2)} PLN`, 80, 55);

  if (balance >= 0) {
    doc.setTextColor(16, 185, 129);
    doc.text(`+${balance.toFixed(2)} PLN`, 138, 55);
  } else {
    doc.setTextColor(239, 68, 68);
    doc.text(`${balance.toFixed(2)} PLN`, 138, 55);
  }

  // Category Breakdown Table
  const categoryExpenses: Record<string, number> = {};
  currentMonthTransactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.amount;
    });

  const categoryRows = Object.entries(categoryExpenses).map(([cat, amount]) => {
    const limitObj = budgetLimits.find((l) => l.category === cat);
    const limit = limitObj ? limitObj.monthlyLimit : null;
    const percent = limit ? ((amount / limit) * 100).toFixed(0) + '%' : '-';
    const status = limit ? (amount > limit ? 'PRZEKROCZONY' : amount > limit * 0.8 ? 'Ostrzezenie' : 'W normie') : 'Brak limitu';
    return [
      cat,
      `${amount.toFixed(2)} PLN`,
      limit ? `${limit.toFixed(2)} PLN` : '-',
      percent,
      status,
    ];
  });

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Struktura Wydatkow i Limity', 14, 76);

  autoTable(doc, {
    startY: 80,
    head: [['Kategoria', 'Wydano', 'Limit miesieczny', 'Uzycie %', 'Status']],
    body: categoryRows.length > 0 ? categoryRows : [['Brak wydatkow w wybranym miesiacu', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    styles: { fontSize: 8.5 },
  });

  // Recent Transactions Table
  const lastTableY = (doc as any).lastAutoTable.finalY || 130;
  
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Ostatnie Transakcje (Wplaty i Wydatki)', 14, lastTableY + 12);

  const transRows = currentMonthTransactions.slice(0, 15).map((t) => [
    t.date,
    t.type === 'income' ? 'Wplata' : 'Wydatek',
    t.title,
    t.category,
    `${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)} PLN`,
    t.comment || '-',
  ]);

  autoTable(doc, {
    startY: lastTableY + 16,
    head: [['Data', 'Typ', 'Tytul', 'Kategoria', 'Kwota', 'Komentarz / Notatka']],
    body: transRows.length > 0 ? transRows : [['Brak zarejestrowanych transakcji', '', '', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
  });

  // Save PDF
  doc.save(`Raport_Budzet_${selectedMonth}.pdf`);
}
