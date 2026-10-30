# AZoom luxury and sports car rental

## Contents

- [Website overview](#website-overview)
- [How to run](#how-to-run)
- [Project structure](#project-structure)

## Website overview

AZoom is a luxury and sports car rental website designed for customers to browse available vehicles, view car specifications, compare models, make bookings, manage payments, and check their booking history. Customers can also access rental policies, branch information, reviews, and account settings.

The website includes an employee portal for managing active bookings, vehicle returns, inspections, penalty fees, payment status, and customer records. Vehicle information is loaded from `data/cars.json`, while account, booking, payment, review, and inspection data is stored in the browser's local storage for demonstration and testing.

## How to run

1. Install the **Live Server** extension in **Visual Studio Code** if it is not already installed.
2. Open the AZoom project folder in **Visual Studio Code**.
3. Find `index.html` in the main project folder.
4. Right-click `index.html`.
5. Select **Open with Live Server**.
6. Wait for the website to open automatically in your browser.
7. If the website does not update after a change, refresh the browser or press `Ctrl + F5`.

> Do not open `index.html` by double-clicking it because the browser may block the website from loading `data/cars.json`.

## Project structure

The project is organised by responsibility. Page-specific files are stored inside `pages/`, reusable files are stored inside `shared/`, vehicle data is stored inside `data/`, and all visual assets are stored inside `images/`.

```text
AZoom/
├── index.html                         # Website entry point
│
├── data/                              # JSON data files
│   ├── cars.json                      # Vehicle details, prices and specifications
│   └── seed-reviews.json              # Sample reviews for each vehicle
│
├── images/                            # Website images
│   ├── azoom-logo.png                 # AZoom logo
│   ├── hero/
│   │   └── hero.jpg                   # Home-page banner image
│   ├── cars/                          # Vehicle images
│   │   └── ALL-FILENAMES.txt          # Required vehicle image filenames
│   └── places/                        # Singapore destination images
│
├── pages/                             # Individual website pages
│   ├── home/
│   │   ├── home.html
│   │   ├── home.css
│   │   └── home.js
│   ├── fleet/
│   │   ├── fleet.html
│   │   ├── fleet.css
│   │   └── fleet.js
│   ├── car/
│   │   ├── car.html
│   │   ├── car.css
│   │   └── car.js
│   ├── login/
│   │   └── login.html
│   ├── signup/
│   │   └── signup.html
│   ├── dashboard/
│   │   └── dashboard.html
│   ├── employee/
│   │   └── employee.html
│   ├── settings/
│   │   ├── settings.html
│   │   └── settings.js
│   ├── payment/
│   │   ├── payment.html
│   │   └── payment.js
│   ├── booking-confirmation/
│   │   ├── booking-confirmation.html
│   │   └── booking-confirmation.js
│   ├── damage-payment/
│   │   ├── damage-payment.html
│   │   └── damage-payment.js
│   ├── contact/
│   │   ├── contact.html
│   │   └── contact.js
│   ├── terms/
│   │   ├── terms.html
│   │   └── terms.js
│   └── privacy/
│       ├── privacy.html
│       └── privacy.js
│
└── shared/                            # Files used by multiple pages
    ├── css/
    │   ├── style.css                  # Global layout and site styling
    │   ├── account.css                # Account and employee-page styling
    │   ├── branches.css               # Branch-card styling
    │   ├── payment.css                # Payment and receipt styling
    │   ├── compare.css                # Vehicle-comparison styling
    │   ├── reviews.css                # Review and rating styling
    │   └── legal.css                  # Terms and privacy styling
    │
    └── js/
        ├── auth.js                    # Accounts, sessions and navigation
        ├── cars-loader.js             # Loads and processes cars.json
        ├── branches.js                # Branch information and one-way fees
        ├── fees.js                    # Late fees, penalties and reports
        ├── refunds.js                 # Cancellation and refund rules
        ├── history.js                 # Booking and inspection history
        ├── review-seed.js             # Loads sample reviews
        ├── reviews.js                 # Review and rating functions
        ├── compare.js                 # Vehicle-comparison functions
        └── account.js                 # Customer and employee account logic
```

### Folder guide

- **`data/`** stores the vehicle catalogue and sample review data.
- **`images/`** stores the logo, home banner, vehicle photos and destination photos.
- **`pages/`** keeps each page's HTML, CSS and JavaScript files together.
- **`shared/css/`** contains styles used across multiple pages.
- **`shared/js/`** contains shared website functions and business rules.

### Image locations

```text
images/hero/hero.jpg                   # Home-page banner
images/cars/<vehicle-name>.jpg         # Main vehicle photo
images/cars/<vehicle-name>-2.jpg       # Optional second vehicle photo
images/cars/<vehicle-name>-3.jpg       # Optional third vehicle photo
images/places/<location-name>.jpg      # Destination photo
```

After adding or replacing an image, refresh the browser with `Ctrl + F5`.
