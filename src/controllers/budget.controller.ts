import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware";
import { Budget } from "../model/budget.model";
import { Expense } from "../model/expense.model";

// Calculate real spent amounts from the expenses collection for a set of budgets.
// This is always accurate — no drift from incremental updates.
async function attachSpent(budgets: any[], userId: string) {
  if (budgets.length === 0) return [];

  const conditions = budgets.map((b: any) => ({
    category: b.category,
    month: b.month,
  }));

  // Build date ranges for all budget months involved
  const monthSet = [...new Set(budgets.map((b: any) => b.month as string))];
  const dateRanges = monthSet.map(m => {
    const start = new Date(`${m}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { month: m, start, end };
  });

  // One aggregation call — group by category + month
  const spentByKey: Record<string, number> = {};
  for (const { month, start, end } of dateRanges) {
    const rows = await Expense.aggregate([
      { $match: { user: userId, date: { $gte: start, $lt: end } } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]);
    for (const row of rows) {
      spentByKey[`${row._id}::${month}`] = row.total;
    }
  }

  return budgets.map((b: any) => {
    const spent = spentByKey[`${b.category}::${b.month}`] ?? 0;
    return { ...b.toJSON(), spent };
  });
}

export async function createBudget(req: AuthRequest, res: Response) {
  try {
    const { category, limit, month } = req.body;
    const budget = await Budget.create({ user: req.userId, category, limit, month });
    res.status(201).json({ ...budget.toJSON(), spent: 0 });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Budget for this category and month already exists" });
      return;
    }
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getBudgets(req: AuthRequest, res: Response) {
  try {
    const budgets = await Budget.find({ user: req.userId }).sort({ month: -1, category: 1 });
    const withSpent = await attachSpent(budgets, req.userId!);
    res.json(withSpent);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getBudget(req: AuthRequest, res: Response) {
  try {
    const budget = await Budget.findOne({ _id: req.params["id"], user: req.userId });
    if (!budget) { res.status(404).json({ message: "Budget not found" }); return; }
    const [withSpent] = await attachSpent([budget], req.userId!);
    res.json(withSpent);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function updateBudget(req: AuthRequest, res: Response) {
  try {
    const budget = await Budget.findOneAndUpdate(
      { _id: req.params["id"], user: req.userId },
      { limit: req.body.limit },
      { new: true, runValidators: true }
    );
    if (!budget) { res.status(404).json({ message: "Budget not found" }); return; }
    const [withSpent] = await attachSpent([budget], req.userId!);
    res.json(withSpent);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function deleteBudget(req: AuthRequest, res: Response) {
  try {
    const budget = await Budget.findOneAndDelete({ _id: req.params["id"], user: req.userId });
    if (!budget) { res.status(404).json({ message: "Budget not found" }); return; }
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getBudgetAlerts(req: AuthRequest, res: Response) {
  try {
    const budgets = await Budget.find({ user: req.userId });
    const withSpent = await attachSpent(budgets, req.userId!);
    const alerts = withSpent.filter(b => b.limit > 0 && b.spent / b.limit >= 0.8);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
