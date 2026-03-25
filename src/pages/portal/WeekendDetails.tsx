export default function WeekendDetails() {
  return (
    <div className="max-w-lg mx-auto px-5 py-8 lg:px-8 lg:py-10">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Ceremony & reception</p>
        <h1 className="font-display text-4xl font-light text-foreground mb-4">Weekend Details</h1>
        <p className="font-body text-sm text-muted-foreground mb-8">Your ceremony order, music selections, timeline, and meal details will appear here as they're finalized.</p>
        <div className="rounded-xl bg-card border border-border shadow-soft p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sage">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="font-display text-lg italic text-muted-foreground">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
