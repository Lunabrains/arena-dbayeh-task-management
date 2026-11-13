// Sample operational task templates. They are illustrative only and are not
// real Arena assignments.

export interface TaskTemplate {
  title: string;
  description: string;
  est: number; // minutes
  category: string;
}

const t = (title: string, description: string, est: number, category: string): TaskTemplate => ({
  title,
  description,
  est,
  category,
});

export const TEMPLATES: Record<string, TaskTemplate[]> = {
  ops: [
    t("Complete venue opening inspection", "Walk every zone before doors open and note anything that is not guest-ready.", 40, "Opening"),
    t("Verify all activity zones are ready", "Confirm each zone is clean, staffed and safe before the first guests arrive.", 30, "Readiness"),
    t("Check daily staff allocation", "Compare today's roster against bookings and cover any gaps.", 20, "Staffing"),
    t("Inspect customer areas", "Check seating, walkways and restrooms for cleanliness and hazards.", 25, "Inspection"),
    t("Complete venue closing checklist", "Close zones, switch off equipment and hand over to security.", 45, "Closing"),
    t("Brief the floor team on today's schedule", "Run a short briefing covering events, bookings and VIP visits.", 15, "Staffing"),
    t("Check entrance and reception desk", "Make sure the entrance is clear, signage is on and the desk is stocked.", 20, "Readiness"),
    t("Walk the parking and drop-off area", "Check lighting, signage and traffic flow at the drop-off point.", 20, "Inspection"),
  ],
  sales: [
    t("Follow up with pending event inquiries", "Call or message every open inquiry from the last 48 hours.", 40, "Follow-up"),
    t("Contact prospective corporate clients", "Reach out to three companies about team days and corporate packages.", 45, "Outreach"),
    t("Confirm upcoming bookings", "Reconfirm timing, headcount and deposits for the next three days.", 30, "Bookings"),
    t("Prepare daily sales follow-up summary", "Summarise today's calls, quotes sent and bookings won.", 25, "Reporting"),
    t("Review unresolved customer inquiries", "Close or escalate every inquiry older than 24 hours.", 30, "Follow-up"),
    t("Send quotes for weekend birthday requests", "Prepare and send quotes for all weekend birthday requests.", 35, "Bookings"),
    t("Update the booking calendar", "Make sure every confirmed booking is on the shared calendar.", 20, "Bookings"),
    t("Call back missed inquiries", "Return all missed calls and unanswered messages from this morning.", 25, "Follow-up"),
  ],
  sports: [
    t("Inspect football pitch", "Check turf, goals, nets and line markings before the first session.", 25, "Pitch"),
    t("Check padel court readiness", "Inspect glass, nets, lights and playing surface on every court.", 25, "Padel"),
    t("Verify sports equipment", "Count and check balls, rackets and bibs; replace anything damaged.", 20, "Equipment"),
    t("Prepare courts for scheduled sessions", "Set up courts and equipment for the next block of bookings.", 30, "Sessions"),
    t("Inspect lighting and safety equipment", "Test floodlights and check first-aid kits and emergency exits.", 30, "Safety"),
    t("Brush and level the padel courts", "Brush the sand evenly and clear the corners on each court.", 35, "Padel"),
    t("Restock the equipment desk", "Refill balls, grips and rental rackets at the equipment desk.", 15, "Equipment"),
    t("Check changing rooms and lockers", "Make sure changing rooms are clean and lockers are working.", 20, "Facilities"),
  ],
  events: [
    t("Prepare birthday event area", "Set tables, theme decor and seating for the next birthday booking.", 45, "Birthdays"),
    t("Verify event setup", "Walk the setup against the booking sheet and fix anything missing.", 25, "Setup"),
    t("Coordinate event staff", "Confirm who is hosting, serving and animating for each event.", 20, "Staffing"),
    t("Check decorations and seating", "Check balloons, backdrops and seat count against the guest list.", 20, "Setup"),
    t("Complete post-event cleanup inspection", "Inspect the area after cleanup and release it for the next booking.", 20, "Cleanup"),
    t("Confirm cake and catering timing", "Confirm delivery and serving times with the kitchen.", 15, "Birthdays"),
    t("Test sound system and microphones", "Test speakers, playlists and microphones on the stage.", 20, "Setup"),
    t("Prepare weekend themed event props", "Sort costumes, props and giveaways for the weekend show.", 40, "Setup"),
  ],
  restaurant: [
    t("Set tables for the next service", "Lay covers, glassware and menus on every table in your section.", 25, "Service"),
    t("Polish cutlery and glassware", "Polish and restock cutlery and glasses for your station.", 20, "Readiness"),
    t("Restock the service station", "Refill napkins, condiments, straws and takeaway boxes.", 15, "Readiness"),
    t("Clear and reset tables after service", "Clear, wipe and reset every table in your section.", 20, "Service"),
    t("Check reservations and prepare tables", "Match tables to today's reservations and mark them reserved.", 15, "Service"),
    t("Serve the birthday party tables", "Serve food and drinks to the birthday tables and keep them cleared.", 45, "Events"),
    t("Complete restaurant opening checklist", "Open the floor, check stations and confirm the kitchen is ready.", 35, "Opening"),
    t("Inspect dining area", "Check tables, chairs, menus and floors for cleanliness.", 20, "Inspection"),
    t("Check hygiene standards", "Run the hygiene checklist for prep areas, fridges and hand-wash points.", 30, "Hygiene"),
    t("Prepare for peak service hours", "Brief the team, pre-set tables and check reservations before the rush.", 30, "Service"),
    t("Check kids' menu stock", "Confirm stock for every kids' menu item and flag shortages.", 15, "Stock"),
    t("Set up terrace seating", "Arrange terrace tables, shade and heaters for the evening.", 25, "Readiness"),
  ],
  maint: [
    t("Inspect venue lighting", "Walk the venue and log every lamp or fixture that needs attention.", 30, "Electrical"),
    t("Check air-conditioning units", "Check filters, temperature and noise on each indoor unit.", 40, "HVAC"),
    t("Resolve reported maintenance issues", "Work through today's reported issues in order of urgency.", 60, "Repairs"),
    t("Verify equipment safety", "Inspect play structures and inflatables for wear, anchors and fixings.", 45, "Safety"),
    t("Complete end-of-day maintenance checks", "Check pumps, panels and generators before closing.", 30, "Closing"),
    t("Test generator and backup power", "Run the generator test and record the fuel level.", 25, "Electrical"),
    t("Fix loose fixtures in play zones", "Tighten or replace loose bolts, nets and padding in the play zones.", 35, "Repairs"),
    t("Check water pumps and restroom plumbing", "Check pressure, leaks and drainage across all restrooms.", 30, "Plumbing"),
  ],
  marketing: [
    t("Prepare social media content", "Draft today's posts and stories for review.", 45, "Content"),
    t("Review upcoming event promotions", "Check that every upcoming event has artwork, copy and a posting date.", 30, "Campaigns"),
    t("Coordinate promotional materials", "Confirm print and on-site materials for this week's promotions.", 30, "Materials"),
    t("Follow up with creative team", "Collect pending designs and give feedback on drafts.", 20, "Content"),
    t("Prepare campaign update", "Summarise reach, engagement and bookings from the active campaign.", 35, "Reporting"),
    t("Capture photos and video on site", "Shoot short clips and photos of today's activities.", 40, "Content"),
    t("Schedule the weekend event announcement", "Schedule posts and stories announcing the weekend theme.", 20, "Campaigns"),
    t("Reply to social media messages", "Answer comments and direct messages across all channels.", 25, "Community"),
  ],
  cx: [
    t("Review customer feedback", "Read new reviews and feedback forms and tag the main themes.", 30, "Feedback"),
    t("Resolve pending complaints", "Contact each guest with an open complaint and agree a resolution.", 40, "Complaints"),
    t("Verify front-desk readiness", "Check the desk is staffed, stocked and the queue system works.", 15, "Front desk"),
    t("Check guest service standards", "Observe greeting, wait times and service at key touchpoints.", 30, "Standards"),
    t("Prepare customer experience summary", "Summarise today's feedback, complaints and wins.", 25, "Reporting"),
    t("Call back guests from yesterday's feedback", "Call guests who left feedback yesterday and log the outcome.", 30, "Feedback"),
    t("Check lost and found log", "Match found items with reports and contact the owners.", 15, "Front desk"),
    t("Update the guest FAQ sheet", "Add this week's common questions and answers for the front desk.", 20, "Front desk"),
  ],
};

export const MANAGER_TEMPLATES: TaskTemplate[] = [
  t("Review team workload and rebalance the queue", "Check each team member's queue and move tasks where someone is overloaded.", 20, "Management"),
  t("Approve next week's roster", "Review the draft roster against bookings and approve or adjust it.", 25, "Management"),
  t("Review open follow-ups with the General Manager", "Go through open follow-ups and agree owners and deadlines.", 20, "Management"),
  t("Check department readiness for the weekend", "Confirm staffing, stock and equipment for the weekend peak.", 30, "Management"),
];
