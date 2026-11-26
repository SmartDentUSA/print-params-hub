/** Channel and coupon breakdowns are subsets, not additional revenue. */
export function eventPromotionRevenue(crmWon: number, storePaid: number): number {
  return Math.round((crmWon + storePaid) * 100) / 100;
}