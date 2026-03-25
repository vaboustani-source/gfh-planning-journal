export default function OurPeople() {
  return (
    <div className="max-w-lg mx-auto px-5 py-8 lg:px-8 lg:py-10">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Guests & lodging</p>
        <h1 className="font-display text-4xl font-light text-foreground mb-4">Our People</h1>
        <p className="font-body text-sm text-muted-foreground mb-8">Your guest list, lodging assignments, and wedding party details will appear here.</p>
        <div className="rounded-xl bg-card border border-border shadow-soft p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sage">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="font-display text-lg italic text-muted-foreground">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
