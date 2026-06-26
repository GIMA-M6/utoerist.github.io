# The Scenic Side of Utrecht

**Developing a scenic route planner for tourists in the city of Utrecht**

Technical University Delft, University of Twente, Utrecht University and Wageningen University & Research: Geographical Information Management and Applications
Module 6: Advanced Geo-information Applications
Students: Koen Bauer, Oleg Bergsma, Jurian Kraaijeveld & Wouter van Voorst
Supervised by: Corné Vreugdenhil (WUR)
June 2026

---

#### PROJECT STRUCTURE  #####

**network (Back end & Network)**
```
.
├── .github                               #Linking structure to sync Github repository with HuggingFace Server repository
├── hf_deploy                             #Contains all files relevant for route planner uploaded to HuggingFace Server
    ├── .gitattributes                    # Contains file to enable Github Actions feature to sync Github repository with HuggingFace Server repository
    ├── api.py                            # Main Python code responsible for running OSMnx libraries and calculating shortest and scenic routes
    ├── Dockerfile                        # File responsible for feeding server instructions on creating dedicated Python container to run code.
    ├── requirements.py                   # Contains required libraries to run the code. Used as instructions for the server.
    ├── utrecht_network.graphml           # Final OSM network file before applying scenic modifications.
    └── utrecht_network_scenic.graphml    # Final network file after applying scenic modifications, used for scenic routing.
├── network_base                          # Contains all files and scripts for extracting the basic OSM network
    ├── network.ipynb                     # Python Jupiter Notebook used to extract and gradually refine network from OSM and export as GRAPHML and GeoPackage.
    └── utrecht_network.graphml           # Final OSM network file before applying scenic modifications.
└── scenic                                # Contains all files and scripts relevant to creating the scenic network
    ├── data                              # Folder containing all raw datasets as GeoJSON (OSM, BGT, BAG, Atlas, RIVM, UtrechtOpen)
    ├── config.py                         # All URLs, study area settings, and output paths
    ├── data_loader.py                    # Loads all raw datasets into the script
    ├── main.py                           # Core code linking all scenic code together.
    ├── scenic_graph.py                   # Code used for assigning scenic weights to the network.
    └── scenic_weights.py                 # Contains determined scenic weights per feature used for assigning.
└── .gitattributes                        # Contains file to enable Github Actions feature to sync Github repository with HuggingFace Server repository
```

**utourist.github.io (Front end)**
```
.
├── app.js                      #Javascript file running the core functionalities of the GitHub Pages webpage and communicating with the backend server.
├── favicon.utourist.png        #Small logo used for the webpage.
├── index.html                  #HTML file used to design the UI and visual look of the webppage.
├── JSONUTRECHT.geojson         #File containing BRT Woonplaats boundary of Utrecht for web visualisation
└── logo.png                    #Logo used for the webpage.

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

