-- Contracts v2: fill-in-the-blank values, amendments, change requests, template history,
-- and the Gilbertsville Farmhouse Venue Contract + Contract Amendment templates.

-- 1. Per-contract values for blanks the hub can't fill automatically ({site_fee}, {client1_phone}, ...)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS contracts_parent_idx ON public.contracts (parent_contract_id);

-- 2. Couples ask for a change to a signed contract; staff answer with an amendment (or decline).
CREATE TABLE IF NOT EXISTS public.contract_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users(id),
  request_text text NOT NULL CHECK (length(trim(request_text)) > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'amendment_sent', 'declined', 'closed')),
  staff_response text,
  amendment_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES public.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_change_requests_event_idx ON public.contract_change_requests (event_id);

ALTER TABLE public.contract_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members and admins read change requests" ON public.contract_change_requests
  FOR SELECT USING (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "Couples request changes on their own contracts" ON public.contract_change_requests
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
    AND status = 'open'
    AND public.is_event_member(event_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.event_id = contract_change_requests.event_id)
  );
CREATE POLICY "Admins manage change requests" ON public.contract_change_requests
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 3. Template history: every save keeps the previous version so an edit can be undone.
CREATE TABLE IF NOT EXISTS public.contract_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  saved_by uuid
);
CREATE INDEX IF NOT EXISTS contract_template_versions_tpl_idx ON public.contract_template_versions (template_id, saved_at DESC);
ALTER TABLE public.contract_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read template versions" ON public.contract_template_versions
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.snapshot_contract_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO public.contract_template_versions (template_id, name, body, saved_at, saved_by)
    VALUES (OLD.id, OLD.name, OLD.body, OLD.updated_at, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS contract_templates_snapshot ON public.contract_templates;
CREATE TRIGGER contract_templates_snapshot
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_contract_template();

-- 4. The templates. Wording transcribed verbatim from the Dubsado venue contract (Sept 2026).
INSERT INTO public.contract_templates (name, document_type, body, requires_both_partners, requires_countersignature, is_active)
SELECT 'Gilbertsville Farmhouse Venue Contract', 'contract', $tpl$GILBERTSVILLE FARMHOUSE VENUE CONTRACT

CLIENT 1: {client1_name}
Phone: {client1_phone}
Email: {client1_email}

CLIENT 2: {client2_name}
Phone: {client2_phone}
Email: {client2_email}

Address: {client_address}

RENTAL SITE
Gilbertsville Farmhouse, 125 Acre Private Property, Event Barns and Lodging Resort located at 336 Coye Brook Road, South New Berlin, NY 13843

EVENT DETAILS & RENTAL PERIOD
DATE OF WEDDING: {wedding_date}
• CHECK-IN DATE: {check_in_date}
   ◦ Check-In Time: {check_in_time}
• CHECK-OUT DATE: {check_out_date}
   ◦ Check-Out Time: {check_out_time}

ESTIMATED NUMBER OF GUESTS: {guest_count}
(For info only - the site fee is not based on guest count)

VENUE SITE FEE: {site_fee}

ADDITIONAL FINANCIAL REQUIREMENTS
CATERING MINIMUM (BILLED TO CLIENT): {catering_minimum}
LODGING ROOM MINIMUM (BILLED TO GUESTS): {lodging_minimum}

PAYMENT SCHEDULE
SITE FEE
• 2 days after contract signing - 25% of site fee
• 30 days after contract signing - 25% of site fee
• 60 days after contract signing - 25% of site fee
• 90 days after contract signing - 25% of site fee

CATERING COSTS
• 7 days after menu approval - 25% of proposed invoice
• TBD days after menu approval - 25% of proposed invoice
• TBD days after menu approval - 25% of proposed invoice
• 30 days prior to event - remaining balance of final invoice

NOTE: Final invoice will be locked in 30 days prior to event, and will include final guest count adjustments, 20% catering administrative fee, and 8% NYS sales tax.

BOOKING DEPOSIT
RESERVATION and PAYMENT DETAILS:
Reservations for wedding events require this contract to be signed and dated, accompanied by a booking deposit. An invoice for your booking deposit will be emailed to you upon our receipt of this signed contract.

BY CHECK:
Make payable to & mail to: Gilbertsville Farmhouse, Inc., 336 Coye Brook Road, South New Berlin, NY 13843.

BY WIRE:
Bank Name: NBT Bank, 52 South Broad Street, Norwich, NY 13815
Account Name: Gilbertsville Farmhouse Inc., 336 Coye Brook Road, South New Berlin, NY 13843
Routing Number: 021303618
Account Number: 7009472627

NOTE: Gilbertsville Farmhouse can process credit card transactions. A 4% processing fee is charged for credit card transactions.

REQUIRED INFORMATION
The following information is required to the Gilbertsville Farmhouse THIRTY (30) DAYS prior to an event date:
1. Exact wedding day activities beginning and ending time (what is on your invitation?);
2. Final count of number of guests;
3. Complete list of vendors with their contact information;
4. Certificate of Liability Insurance for minimum $1,000,000 liability;

TERMS AND CONDITIONS

1. USE OF PREMISES AND GROUNDS
A. Facility and grounds are only to be used for stated purpose(s).
B. The event spaces shall be reserved for the exclusive use of the Clients for all formal events, with coordination, set-up, break-down and oversight by Gilbertsville Farmhouse staff.
C. Formal events must end by 11PM, unless a formal After-Party is added, which extends the formal event. In that case, the formal event must end by 1AM (unless otherwise authorized in writing). A formal After-Party extension incurs additional fees.
D. The grounds, which consist of all outdoor spaces and all lodging areas, are reserved for the exclusive use of the Clients and their authorized on-site guests from the above stated check-in time through the above stated check-out time.
E. Off-site guests are welcome onto the property to visit with the Clients during informal activities or gatherings, such as social time between events. Off-site guests may not wander the property unaccompanied or use lodging areas or other facilities on their own, or remain on the property all day, solely to use the facilities, or to use public bathrooms to change and get ready for an event.
F. Off-site guests are welcome starting at 9:30AM and until the end-time of the day's last formal event. To further clarify, off-site may not be on site past the end of the day's last formal event's end. If off-site guests will be on site during meal events, they must be added to the headcount for that event (an example is during arrival day lunch). NOTE: If the number of off site guests exceeds 35, then additional staffing may be required to ensure safety and proper supervision. Client agrees to pay for such additional staffing.
G. Every evening, after the end of the last formal event, a bonfire will be lit at the Hearth Guesthouses Village. That is defined as an informal event and there is no curfew. However, no off-site guests are permitted to attend that bonfire. Only Gilbertsville Farmhouse staff are allowed to build and light any bonfires.
H. Owners and/or hired staff of Gilbertsville Farmhouse will be on-site during the duration of the rental period.
I. The Farmhouse Residence common space will be reserved for hair/makeup on event days. It may not be used as an extension of any formal events, including the ceremony or reception.
J. The Farmhouse Residence common space may be used for babysitting or as a common child care area with an authorized/contracted sitter.
K. Gilbertsville Farmhouse staff routinely tidy up common areas including bathrooms, outdoor areas, the Fenimore Master Guesthouse outdoor lounge, and the Farmhouse Residence common living space.
L. Gilbertsville Farmhouse does not provide housekeeping services during the rental period, however, our guest services team will provide any towel change-out as requested by guests.
NOTE: Turndown service is available at an additional cost.
M. Smoking is prohibited inside all building, event spaces, lodging rooms, and within 10 feet of all entrances, exits, and windows. Smoking is prohibited inside the Farmhouse Residence and inside all lodging rooms/cabins. There are NO EXCEPTIONS.
N. No rice, confetti or glitter is allowed inside or outside the facility. No artificial rose petals allowed.
O. Due to the nature of the venue and the multiple on-site animals, no client or guest dogs or pets are allowed.
P. Candles or live flame may not be used inside any lodging room. For formal events, candles must be in glass containers that prevent wax from dripping on surfaces.
Q. Music policy:
• Formal outside music must end at 9PM. Last dance announcement no later than 8:55PM.
• Formal inside dance music must end at 11PM. Last dance announcement no later than 10:55PM. A formal after-party extents this requirement to 1AM.
• At the Hearth Guesthouse Village, non-amplified outdoor music is allowed at all times.
• At the Farmhouse Residence and beach, outdoor light music is allowed until 12AM - please be respectful of our neighbors.
R. DJs/Bands/Musicians must adhere to Gilbertsville Farmhouse music policy. Please respect that the Gilbertsville Farmhouse is located in a residential neighborhood. Continued use depends upon the good will of our neighbors. Loud music will jeopardize our relationship with the community. DJs/Bands/Musicians that abuse our usage rules will not be allowed back.
S. Children must ALWAYS be supervised. Children are prohibited from exploring the grounds, the beach, pond and all buildings without adult supervision. All persons are prohibited from climbing any buildings or structures including the silos.
T. Dance floors on the grass are not allowed.
U. On-site Gilbertsville Farmhouse staff monitors event activities and has the authority to enforce contract rules. Gilbertsville Farmhouse staff can terminate rental if the client does not honor contract or local law.
V. The Client hereby agrees that Gilbertsville Farmhouse has the right to use and publish professional photographs of the Client and the Event on their website, blog or other media outlets. Client also acknowledges and agrees that Gilbertsville Farmhouse may film content during the rental period that may include decor and scenes from the events for social media.
W. After the event, Client agrees to provide a testimonial/review of Gilbertsville Farmhouse, for publication on their website, blog, or other media outlets within 60 days from their event.

2. SET-UP AND BREAKDOWN
A. Gilbertsville Farmhouse will provide wooden farmhouse banquet tables and wood cross-back banquet chairs for up to 250 guests.
B. Gilbertsville Farmhouse will provide seating for up to 250 guests at the Hilltop Cathedral ceremony site.
C. Client must rent seating for a ceremony located in the Woodsy ceremony site.
D. Gilbertsville Farmhouse does not provide event tents or table linens.
E. All rental equipment shall be stacked on the back patio, not on the grass, and removed from the premises no later than 11.00 AM the next business day after check-out.
F. DO NOT use nails, tacks or staples in the walls/woodwork/arbor. IF tape is used, it must be painter's tape. All decorations and tape must be removed after the event.
G. Furniture on the property shall not be moved without prior permission and arrangements. All spaces should be kept in the same condition and layout.
H. All trash and recyclables must be disposed of in proper receptacles in the lodging spaces and on the property.
I. If signs were placed in the neighborhood they must be removed.
J. Immediately notify on-site staff of any damages that may occur during the event.
K. Third-party vendors shall have access from 10AM on the day of a formal event until 30 minutes past the end time of the formal event to set-up and clean-up/break-down of any display and/or equipment. It is the responsibility of the third-party vendor to move their equipment within the facility or grounds, under direction and supervision by Gilbertsville Farmhouse staff. Staff will assist in transporting third-party vendors to ceremony sites or outdoor event sites for set-up and break-down. All third-party vendors must check-in/out with our Event Director, and provide a Certificate of Insurance 14 days prior to the event.

3. SECURITY DEPOSIT & PROPERTY DAMAGE
A. Client agrees to provide a valid credit card prior to the event as security for any and all damages, excessive cleaning, or additional time charges arising out of Clients' use of the Gilbertsville Farmhouse facilities and property.
B. Within 24 hours following the event, the Event Director will assess the property for damages, excessive cleaning requirements or unauthorized use beyond the contracted rental period. If such costs are incurred, Gilbertsville Farmhouse will provide written notification and documentation to the Clients within seven (7) days describing the damages or charges prior to processing any credit card charges. Client expressly authorizes Gilbertsville Farmhouse to charge the Clients' credit card for the full cost of repair, replacement, cleaning and/or additional time charges, up to $10,000.
C. If damages or costs exceed the authorized charge amount of $10,000, or the maximum available on the credit card, Client shall remain personally liable for the full balance due. The amounts shall be payable immediately upon receipt of written notification from Gilbertsville Farmhouse. Client waives any right to dispute such charges with the credit card issuer, except in the case of demonstrable fraud.
D. Client is strongly encouraged to obtain event insurance that specifically covers property damage to the property. It is the client's responsibility to recover losses from the insurance company. Any amounts exceeding the stated damage cap may be claimed under the event insurance.

4. INDEMNIFICATION AND HOLD HARMLESS AGREEMENT
The Client agrees to indemnify and hold Gilbertsville Farmhouse and its owners, its officers and agents harmless from and against any and all liability, claims, actions, demands or losses of any kind and nature that may occur or be claimed with respect to any person or persons, corporation, property of chattels, on or about the Gilbertsville Farmhouse, or to the property itself resulting from any act done, or omission by or through the Client, its agents, contractors, employees, invitees, or any person on the premises of the Gilbertsville Farmhouse by reason of Client's use or occupancy thereof. These may include, but are not limited to accident, injury or damage to property arising from any act of the Client or Client's guest, whether intentional or negligent, which occur during use. Client agrees to pay all costs and attorney fees incurred by the Gilbertsville Farmhouse owner and representatives in defending any such claim or action brought against the owner and representatives. Irrespective of the foregoing, Client shall have no obligations under this contract for any claims to the extent caused by the negligence, willful misconduct, or violation of law by Gilbertsville Farmhouse and its owners, officers, and agents.

5. PERSONAL AND ABANDONED PROPERTY
The Gilbertsville Farmhouse and its representatives assume no responsibility for any property placed in the facility or on the premises or any property that is left on the premises after the event is over.

6. CANCELLATION POLICY – PLEASE READ CAREFULLY!!
A. The booking deposit is non-refundable.
B. All cancellations must be in writing.
C. Cancellations made more than twelve (12) months prior to the event: 70% of the site fee and catering invoice total is forfeited and nonrefundable. 30% of the totals shall be refunded if the entirety of the fees have been paid. If the damage/security deposit has been paid in addition to the entire site fee then that deposit will be refunded to the Client (See paragraph "G"). Any unpaid portion of the forfeited amounts will be due and payable in order to terminate the contract.
D. Cancellations made less than twelve (12) months prior to the event: The entire site fee and catering invoice is forfeited and nonrefundable. If the damage/security deposit has been paid in addition to the entire site fee then that deposit will be refunded to the Client (See paragraph "G"). Any unpaid portion of the forfeited amounts will be due and payable in order to terminate the contract.
E. Gilbertsville Farmhouse may cancel or postpone events due to inclement weather, emergency conditions, pandemics, government restrictions, or other events beyond the reasonable control of the owners of Gilbertsville Farmhouse ("Force Majeure Events"). Client will be notified as soon as it is determined that an Event would be unsafe or unlawful to proceed, based on information provided by newscasts, government authorities, or other reliable outside agencies.
F. In the event of a Force Majeure Event, Gilbertsville Farmhouse's sole obligation shall be to offer Client an alternate date for the event within twelve (12) months of the original date, subject to availability. Gilbertsville Farmhouse cannot guarantee availability of peak-season weekend dates for rescheduled events, however, Gilbertsville Farmhouse will act in good faith and make reasonable efforts to reschedule event for a favorable alternate date.
G. Client acknowledges and agrees that in the event of Force Majeure Events (including, but not limited to, pandemics, public health emergencies, or government-mandated shut-downs affecting multiple scheduled events), Gilbertsville Farmhouse shall have no obligation to issue refunds of any kind.
H. The Client cannot hold the Gilbertsville Farmhouse responsible for failure to provide basic facilities and services due to emergencies, catastrophes or interruptions of public utilities, or an Act of God, before or during the time of the event.
I. It is STRONGLY SUGGESTED to purchase WEDDING CANCELLATION INSURANCE which covers Client for expenses/losses in case Client is forced to cancel their event. This covers events such as sickness and MILITARY DEPLOYMENT. One (of many) company that sells this insurance is www.wedsafe.com. It is relatively inexpensive, even for high budget events. Please ask and determine whether your insurance covers pandemic events, or if coverage for such an event requires an additional rider/fee. Gilbertsville Farmhouse shall not be responsible for any costs or losses that may be recoverable through Client's insurance.

7. INSURANCE
Client shall obtain and maintain, at its sole expense, a policy of Special Event Liability Insurance (including Host Liquor Liability) with minimum limits as listed below. Client must provide a Certificate of Liability Insurance 15 days prior to the event. This insurance certificate must explicitly state the following conditions:
A. $1,000,000 Bodily Injury and Property Damage Liability Limits;
B. $1,000,000 Host Liquor Liability must be specifically included in the above coverage;
C. Gilbertsville Farmhouse, Inc., Harvest 336 LLC., Aldo & Sharon Boustani, its officers, agents, and employees must be named as additional insured for any claim or claims resulting from or growing out of the Client or event. Failure to provide evidence of this insurance to the Gilbertsville Farmhouse coordinator, 15 days prior to your event, can cause immediate cancellation of your event. Cancellations resulting from failure of renter to provide the Gilbertsville Farmhouse with a proper and timely certificate of liability insurance will be treated as a Client-caused cancellation occurring less than 30 days prior to the event. One often used option for wedding insurance is www.WedSafe.com

8. FOOD & ALCOHOL
A. Client acknowledges and agrees that Harvest 336 LLC will be the exclusive caterer and bar service of this weekend event. Catering services are billed separately after a consultation with our catering team and final menu selections. Catering costs include a per person food cost and a 20% administrative fee. The administrative fee is not gratuity.
B. Menu tastings are available at a cost of $70pp. A selection of available tasting dates will be presented to Client in order to select a date to come in and sample the selected menu items. Private tastings are held in the beginning months of the calendar year of the event, typically between January and February. The tasting cost will be added to the final catering invoice.
C. Client agrees and warrants that there shall be NO CONSUMPTION OF ALCOHOL BY PERSONS UNDER AGE 21. Client agrees to refuse to allow alcohol to be served to, or consumed by, any person who is visibly intoxicated or under 21 years of age. Client shall monitor all service, if any, of alcohol and specifically acknowledges that Client is solely liable for the consumption of any alcohol by any person on the Premises and that such liability shall extend to any aspect regarding the consumption of alcohol. Gilbertsville Farmhouse may ask guests for identification to verify age and reserves the right to ask to the entire party to leave if (1) a minor is consuming alcohol; (2) an adult is providing alcohol to a minor; or (3) a guest or guests appears intoxicated and refuses to leave the Premises. Client shall indemnify and hold Gilbertsville Farmhouse, Inc. and its owners harmless from all liability for improper use of alcohol.
D. Catering Cost Adjustment: The catering fees outlined in this Agreement represent a good-faith estimate based on current market pricing and are appropriately projected for the Client's event year. Client acknowledges that food and supply costs are subject to market conditions beyond Gilbertsville Farmhouse's control.
In the event that food and supply costs increase by more than 6% from the date of contract execution to 60 days prior to the Event Date, the difference above that threshold will be reflected as a line-item adjustment on the Client's 60-day final invoice, broken down by meal or service event (e.g., cocktail hour, reception dinner, late night snack).
Gilbertsville Farmhouse will provide written documentation of the cost increase upon request.

9. PACKAGE
This package includes:
• Exclusive access to the resort from the above stated check-in time to the above stated check-out time.
• Lodging for the host couple.
• Month-of event planning and weekend coordination.
• Guest services team, and golf cart shuttles for the rental period.
• Nightly bonfires at the Hearth Guesthouses Village.
• Farm tables, cross-back chairs, venue lighting and drapery.
• Dishware, flatware, glassware.

10. FORMAL AFTER-PARTY EXTENSION
If a formal after-party is added at a future time, the following conditions will apply:
A. After-party begins at 11:00pm and ends at 1:00am (unless otherwise approved in writing by GF)
B. Guests must be pre-invited to the after party and a list provided to Gilbertsville Farmhouse.
C. Bar service must extend through the end of the after-party.
D. Catering contract must include a late night snack for guests of the after-party.
E. After-party takes place in the after-party lounge and shall not extend outdoors.
F. As we want to be considerate of neighbors and noise ordinances, it is understood by all parties that the music level of the after-party must be lower than the sound level of the reception, although at a level that is still appropriate for a dance party.

11. ADDITIONAL LODGING TERMS
A. Rental of {required_suites} Gilbertsville Farmhouse Guesthouse Suites is REQUIRED.
B. Rental of the Fenimore Master Guesthouse (Sweetheart Cabin) is INCLUDED for the rental period.
C. The lodging rooms are reserved for rental by Clients and their guests exclusively and will be billed separately.
Client shall guarantee all lodging rentals.
• The Hearth Guesthouses will be priced at $450 per night, with a two night minimum.
• The Grove Guesthouses will be priced at $450 per night, with a two night minimum.
• The Farmhouse Residence suites will be priced at $450 per night, with a two night minimum.
• The Victoria Guesthouses will be priced at $450 per night, with a two night minimum.
• NEW double king cabins will be priced at $550 per night, with a two night minimum (plus $25/night for 3rd and 4th guests each.)
D. In choosing to host a multiple-day event, Client acknowledges that all on-site lodging is exclusively reserved for Client and their guests for an overnight stay for a two (2) night minimum beginning on the above stated check-in date and ending on the above stated check-out date.
E. Client acknowledges that the use of the Farmhouse Residence is for up to 20 people and the Hearth, Grove and Victoria Guesthouse clusters are for up to 20 people each. The Fenimore Master Guesthouse is to be used for 2 people. The double king cabin cluster is for up to 40 people.
F. The Farmhouse Residence may not be used as additional party space during the wedding or any other event, including rehearsal dinner or farewell brunch. In other words, the formal events should not extend into the Farmhouse Residence.
G. All information requirements, music/noise regulations, alcohol license and insurance requirements that apply to the wedding event also apply to the rehearsal dinner event and the farewell brunch event.
H. All lodging rooms must be delivered damage-free at check-out.
I. Gilbertsville Farmhouse does not provide any housekeeping services during the rental period.
J. Children are not permitted in the Farmhouse Residence common area unattended during the wedding event.
K. All lodging rooms must be reserved and paid in full no later than 30 days prior to the event date.
L. Lodging room rates ate subject to 8% NYS sales tax and 6% Otsego county occupancy tax.
M. Additional pop-up tents may be added and contracted for by a reputable and insured third party vendor, and with authorization by Gilbertsville Farmhouse. An additional resort/amenities fees of $350 per unit will be added to the Client's site fee for up to two (2) guests per unit. Additional guests must be approved by GF and are charged an additional $25/night (per additional person.)

AGREEMENT BY SIGNATURE
Signature indicates the Client agrees to all terms and conditions stated herein.$tpl$, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.contract_templates WHERE name = 'Gilbertsville Farmhouse Venue Contract');

INSERT INTO public.contract_templates (name, document_type, body, requires_both_partners, requires_countersignature, is_active)
SELECT 'Contract Amendment', 'addendum', $tpl$AMENDMENT TO THE GILBERTSVILLE FARMHOUSE VENUE CONTRACT

This Amendment is made between Gilbertsville Farmhouse, Inc. and {couple_names} ("Client"). It amends the {original_contract_title} for the wedding on {wedding_date}, signed on {original_signed_date} (the "Contract").

The parties agree to the following changes to the Contract:

{amendment_changes}

All other terms and conditions of the Contract remain unchanged and in full force and effect. Where this Amendment and the Contract conflict, this Amendment controls.

AGREEMENT BY SIGNATURE
Signature indicates the Client agrees to this Amendment.$tpl$, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.contract_templates WHERE name = 'Contract Amendment');
