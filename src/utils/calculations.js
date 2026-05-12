export const calcDifference = (taken, returned) => {
  const t = parseFloat(taken) || 0;
  const r = parseFloat(returned) || 0;
  return Math.max(0, t - r);
};

export const calcRowTotal = (difference, price) =>
  difference * (parseFloat(price) || 0);

export const calcSummary = (rows, iceCreams) => {
  const subtotal = rows.reduce((sum, row) => {
    const ic = iceCreams.find((i) => i.id === row.iceCreamId);
    if (!ic) return sum;
    const diff = calcDifference(row.quantityTaken, row.quantityReturned);
    return sum + calcRowTotal(diff, ic.price);
  }, 0);
  const deduction = subtotal * 0.2;
  const finalAmount = subtotal - deduction;
  return { subtotal, deduction, finalAmount };
};
