# Alternative Fuel Station Locator  
### Final Project Checkpoint #1 — Project Proposal  
**Group AB4:** Maikhanh T, Robbie Rivera, Naod Alemu, Jaeden Cox Arnsdorf  

---

## Intention and Target Audience  
For our final project, we would like to create a website that displays **alternative fueling locations** for users. This would be a useful resource for **travelers and general users of alternative fuels** to find and navigate to the stations they need.  

Users will be able to use their **current location** or **type in a selected location** to find nearby stations within a **selectable distance radius**, with **filters based on their needs**. Selecting a station will show detailed information such as **connector count, connector size, and fuel type**.  

Our dataset includes information for stations across the **United States and parts of Canada**, but our initial focus will be the **Washington area**. We plan to expand our spatial coverage as our functionality and data manipulation evolve throughout the project.  

---

## Available Datasets  
We will be using data from the **U.S. Department of Energy’s Alternative Fuels Data Center (AFDC)** API:  
[https://developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/ev-charging-units/#request-parameters](https://developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/ev-charging-units/#request-parameters)

---

## Required Multimedia  

### Icons  
Different **icon symbology** will be used to indicate various fuel type locations on the website.  

### Color Grading  
We will apply **color grading** to portions of the map based on the **density of charging or fuel types**, helping users identify whether they are in a **fuel desert** for their particular needs.  

---

## Functions  

### Distance Sorting and Navigation  
Using **Turf.js** and the **Mapbox Directions API**, we will create a function that calculates the **distance from the user to a selected fueling station** by generating a line between two points. The Directions API will then generate **driving directions** along the road network to guide users to the chosen station.  

### Filtering  
The website will include **filters for distance, connector size, and connector count**. A dedicated tab will allow users to **filter by fuel type**, serving as the primary filtering function.  

### Vehicle Selection  
Users will be able to **select their vehicle** if they are unsure which filters to use. The system will automatically **update the filters** to match the vehicle’s fueling requirements.  
