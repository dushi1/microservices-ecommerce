# The Architecture, Explained Like You're 5

> The grown-up version lives in [ARCHITECTURE.md](./ARCHITECTURE.md). This one tells the same story with a toy shop.

## The Story: Our Toy Shop

Imagine we're building the best toy shop in the world. Not a normal shop — a *magic* one that never sleeps, never loses a toy, and never mixes up an order. Here's how it works.

---

## The Shop Has Many Little Rooms (Microservices)

A normal shop is **one big room**: one person takes your order, finds the toy, wraps it, takes your money, and mails it. If that one person gets sick, the whole shop stops.

Our shop is different. It's a building with **many little rooms**, and each room has exactly one job and one worker:

| Room in the shop | The worker | Their one job |
|---|---|---|
| 🚪 The front desk | **API Gateway** | The only door customers use. Checks your name tag, points you to the right room. |
| 🪪 The badge room | **Auth Service** | Makes your name tag (login), checks if it's real, gives you a new one when it fades. |
| 🧸 The toy display | **Product Service** | Shows all the toys, tells you prices, helps you find the dinosaur aisle. |
| 📦 The box room | **Order Service** | Takes your cart, starts the whole "buy it!" magic. The boss of checkout. |
| 🏦 The money room | **Payment Service** | Counts your coins and says "yes, paid!" or "nope, card declined." |
| 📚 The toy warehouse | **Inventory Service** | Counts toys on shelves. Knows if we still have 5 teddy bears or zero. |
| 💌 The mail room | **Notification Service** | Writes you a letter ("Your toys are coming!") when something happens. |

**Why little rooms instead of one big room?**
- If the mail room worker takes a nap, you can still buy toys. The whole shop doesn't stop.
- If lots of customers come at Christmas, we can hire *more* workers just for the busy rooms.
- Each worker only needs to learn one job really, really well.

This is what grown-ups call **microservices**. Each room is a "service" living in its own little computer program.

---

## Customers Can Only Talk to the Front Desk (API Gateway)

You don't just walk into the money room and yell "PAY ME!". That would be chaos.

**Rule #1 of our shop: customers only talk to the front desk.** The front desk worker:
1. Looks at your name tag (checks your **JWT** — a magic badge that proves who you are)
2. Walks to the right room and asks for you (**proxying** — passing your request along)
3. Comes back with the answer
4. If you ask for too many things too fast, says "whoa, slow down!" (**rate limiting**)

In our code, the front desk is the **API Gateway on port 3000**, and your web browser (the storefront) only ever talks to it.

---

## Rooms Talk to Each Other Two Ways

Grown-up shops have this problem too: workers need to talk to each other. Our shop has two ways.

### Way 1: The Walkie-Talkie (gRPC) — "I need an answer RIGHT NOW"

When the box room wants to know "do we have 3 teddy bears?", it can't wait around. It grabs a walkie-talkie and calls the warehouse: *"Do we have 3 teddy bears? Answer now!"*

The warehouse answers instantly: *"Yes!"* or *"No, only 2!"*

That super-fast, structured phone call is **gRPC**. We use it for:
- Order room → Warehouse room: "reserve these toys for me!"
- Order room → Money room: "charge this customer!"

The exact words they're allowed to say are written in magic notebooks called **proto files** (`packages/contracts/proto/`). Both workers read the same notebook, so they never misunderstand each other.

### Way 2: The Loudspeaker (Kafka) — "Hey everyone, something happened!"

Some news doesn't need an instant answer. When a toy is sold, the mail room wants to write you a letter — but nobody needs an answer *right now*.

So rooms have a **loudspeaker** (that's **Kafka**). Instead of telling one worker directly, a room just announces:

> *"Attention! A toy was just sold! Here are the details!"*

Every room hears it. The rooms that care (mail room) act on it. The rooms that don't care ignore it.

The loudspeaker has **5 channels** (called **topics**): `user-events`, `product-events`, `order-events`, `payment-events`, `inventory-events`. Each announcement is written on a card in a very strict format (our **event schemas**) so nobody misreads it.

**Why is the loudspeaker great?** If the mail room worker is on a coffee break, announcements wait in a pile for them, and they read them when they're back. Nobody misses the news. That's why grown-ups call it "event-driven."

---

## The Magic of Buying a Toy (The Checkout Saga)

This is the most clever part of our shop. Buying a toy has steps, and *every step must either finish perfectly or cleanly undo itself*.

Imagine you buy a teddy bear:

1. **You hand your cart to the box room** ("Order created! Status: waiting...")
2. **Box room walkie-talkies the warehouse**: "Hold 1 teddy bear for this customer!" → Warehouse takes it off the shelf and holds it. 🧸
3. **Box room walkie-talkies the money room**: "Charge them $19.99!" → Money room counts... "Declined! No money!"
4. **The magic undo**: because the money failed, the box room tells the warehouse: *"Put the teddy bear back on the shelf, this sale is off."* The order is stamped CANCELLED.

**Nobody loses anything.** The teddy bear goes back for the next kid. The customer isn't charged. The order honestly says "cancelled."

This careful dance — where every step has a matching *undo* step — is called a **saga**. It's the most important magic trick in our shop, and building it is the biggest thing you'll learn.

*(Want to see the undo in action? In our shop there's a pretend credit card that ALWAYS gets declined. Try buying with it and watch everything politely un-happen.)*

---

## Every Room Has Its Own Notebook (Database per Service)

The warehouse doesn't share its counting notebook with the money room. Why? Because if workers share one notebook, they scribble over each other's notes, and if the notebook is lost, EVERYONE is lost.

So each room keeps its **own notebook** (its own **database**):
- Badge room → `auth_db` (all the name tags and secrets)
- Toy display → `product_db` (every toy, price, photo)
- Box room → `order_db` (every cart and order)
- Money room → `payment_db` (every payment)
- Warehouse → `inventory_db` (how many of each toy is on the shelf)

If a room needs info from another room's notebook, it doesn't peek — it **asks that room** (walkie-talkie or loudspeaker). That keeps everyone honest.

*(Right now all five notebooks live inside one big filing cabinet — a Docker Postgres on your computer. Later they move to the magic cloud filing cabinet — Floci's "RDS".)*

---

## The Contract Book (packages/contracts)

Before anyone builds a room, everyone agrees on a **contract book**. It says exactly:

- What words customers may use at the front desk (`openapi.yaml` — every question and every possible answer)
- What rooms may say on walkie-talkies (`proto/` files)
- What may be shouted on the loudspeaker (`events/` schemas)
- Even **checklists** (zod schemas) that automatically catch wrong messages: "this order has no name on it! REJECTED!"

Both the shop (backend) and the shop's website (storefront) read the same contract book. If someone changes the book, everyone finds out immediately because their code stops working — *before* real customers ever notice. That's why the book lives in its own special folder: `packages/contracts`. It's the most important folder in the whole shop.

---

## The Shop's Website (apps/storefront)

Customers don't walk into the building — they browse the shop's **website**. That's the pretty part, built with **React**:

- A page with all the toys (with pictures!)
- A page for each toy
- A shopping cart page
- A checkout page (where the saga magic starts)
- A page where you watch your order change from "waiting..." to "shipped!" — live, like watching a package move on a map
- Pages to make a name tag (register) and show it (login)

The website is also a bit magic: it *remembers* what it already asked for (so it doesn't ask the front desk a million times — that's **React Query**), and if your name tag fades mid-visit, it quietly gets you a new one without you noticing (**auto-refresh**).

---

## The Magic Cloud: Floci (Where the Shop "Really" Lives)

Real toy shops live in real buildings. Ours lives in a **pretend cloud** on your computer called **Floci**.

Floci is like a giant dollhouse that looks *exactly* like the real Amazon cloud:

| Real cloud thing | What it is in our dollhouse |
|---|---|
| ECS | The shelves where our room-boxes (containers) sit and run |
| EKS / Kubernetes | A robot nanny that runs the rooms, restarts them if they crash, and clones busy ones |
| RDS | The magic filing cabinet for notebooks (real Postgres!) |
| MSK | The loudspeaker system (real Kafka!) |
| ElastiCache | A super-fast sticky-note board (Redis) |
| SES | The mail room's real stamp and envelopes |
| S3 | The photo album where toy pictures live |
| ECR | The box factory warehouse (where container boxes are stored) |

**Why is this cool?** Because when you finally get a *real* cloud account someday, you already know every button — you practiced on an identical dollhouse for free.

---

## Growing Up: The Plan (Phases)

Big shops aren't built in one day. Ours grows in steps:

1. ✅ **Write the contract book** (done!)
2. ✅ **Set up the notebooks** (Postgres + Redis running, toy list filled in)
3. 🔨 **Build each room one by one** (badge room, toy room, box room, money room, warehouse, mail room, front desk)
4. 🎀 **Move into the dollhouse** (Floci: ECS, real Kafka, real Postgres)
5. 🤖 **Hire the robot nanny** (Kubernetes keeps rooms alive, restarts crashed ones, adds more workers when it's busy)
6. ✨ **Make it shiny** (fancy logging, alarm bells when something breaks, auto-deploying new room versions)

---

## The One-Paragraph Summary

> Our toy shop is many small rooms, each with one job and its own notebook. Customers only talk to the front desk. Rooms ask each other urgent questions on walkie-talkies (**gRPC**) and announce news on a loudspeaker (**Kafka**). Buying a toy is a careful dance where every step can undo itself (**the saga**). Everyone follows one contract book (**packages/contracts**) so nobody ever misunderstands. The pretty website (**storefront**) makes it all feel magic to customers. And the whole shop lives in a pretend-cloud dollhouse (**Floci**) that behaves exactly like the real thing.
