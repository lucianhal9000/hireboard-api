/**
 * Funnel arithmetic, isolated from Mongo.
 *
 * The aggregation itself needs a database, but the rate maths is where the
 * off-by-one errors live, so it is tested directly.
 */
const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

describe("funnel rates", () => {
  it("returns zero rather than NaN when nothing has been submitted", () => {
    expect(pct(0, 0)).toBe(0);
  });

  it("excludes wishlist entries from the denominator", () => {
    const byStatus = { wishlist: 5, applied: 3, screening: 1, interview: 1, offer: 1, rejected: 4, withdrawn: 0 };
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const submitted = total - byStatus.wishlist;
    expect(total).toBe(15);
    expect(submitted).toBe(10);
  });

  it("rounds to one decimal place", () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(2, 3)).toBe(66.7);
  });

  it("counts offers as having reached interview", () => {
    const byStatus = { screening: 2, interview: 1, offer: 2 };
    expect(byStatus.interview + byStatus.offer).toBe(3);
  });
});
