# The Scenic Side of Utrecht

**Developing a scenic route planner for tourists in the city of Utrecht**

Technical University Delft, University of Twente, Utrecht University and Wageningen University & Research: Geographical Information Management and Applications
Module 6: Advanced Geo-information Applications
Students: Koen Bauer, Oleg Bergsma, Jurian Kraaijeveld & Wouter van Voorst
Supervised by: Corné Vreugdenhil (WUR)
June 2026

---

#### PROJECT STRUCTURE  #####

**network (Backend & Network)**
```
.
├── .github/workflows     #Linking structure to sync Github repository with HuggingFace Server repository
├── hf_deploy             #Contains all files relevant for route planner uploaded to HuggingFace Server
├── network_base          #Contains all basic OSM network files and scripts
    └── extra               #Contains leftovers of network files
└── scenic                #Contains all files and scripts relevant to scenic network
    └── extra               #Contains leftovers of scenic code

```

**utourist.github.io (Frontend)**
```
.
├── JSONUTRECHT.geojson     #File containing BRT Woonplaats boundary of Utrecht for web visualisation
├── app.js                  #Javascript file running the core functionalities of the GitHub Pages webpage and communicating with the backend server.
├── favicon.utourist.png    #Small logo used for the webpage.
├── index.html              #HTML file used to design the UI and visual look of the webppage.
└── logo.png                #Logo used for the webpage.

```

---



Load, weight, and export scenic geographic datasets for Utrecht (Netherlands).  
Weights are derived from empirical scenicness coefficients (see [Data & Methods](#data--methods)).



```
.
├── data_loader.py        # Loads all raw datasets (OSM, BGT, BAG, Atlas, RIVM, UtrechtOpen)
├── scenic_weights.py     # Assigns normalised scenicness weights to each layer
├── config.py             # All URLs, study area settings, and output paths
├── main.py               # Entry point — runs the full pipeline
├── requirements.txt      # Python dependencies
└── output/               # Created automatically on first run
    ├── utrecht_scenic_weighted.gpkg
    └── scenic_weight_lookup.csv
```

---

## Requirements

- **Python ≥ 3.9**
- Internet access (data is fetched live from public WFS endpoints)

Install dependencies:

```bash
pip install -r requirements.txt
```
Check API server status on: https://huggingface.co/spaces/OlegBergs/route_backend_api/tree/main
---

