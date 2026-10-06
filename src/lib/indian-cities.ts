/**
 * Major Indian cities grouped by state/UT.
 * Used for type-ahead suggestions in the address form.
 * Customers can still type a town not in this list.
 */
export const CITIES_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": [
    "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool",
    "Rajahmundry", "Kakinada", "Tirupati", "Kadapa", "Anantapur",
    "Eluru", "Ongole", "Vizianagaram", "Tenali", "Proddatur",
    "Chittoor", "Hindupur", "Machilipatnam", "Srikakulam", "Bhimavaram",
  ],
  "Arunachal Pradesh": [
    "Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro",
    "Bomdila", "Along", "Tezu", "Roing", "Daporijo",
  ],
  "Assam": [
    "Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon",
    "Tinsukia", "Tezpur", "Bongaigaon", "Karimganj", "Diphu",
    "North Lakhimpur", "Goalpara", "Sivasagar", "Dhubri", "Nalbari",
  ],
  "Bihar": [
    "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia",
    "Darbhanga", "Bihar Sharif", "Arrah", "Begusarai", "Katihar",
    "Munger", "Chhapra", "Hajipur", "Sasaram", "Dehri",
    "Samastipur", "Bettiah", "Motihari", "Siwan", "Nawada",
  ],
  "Chhattisgarh": [
    "Raipur", "Bhilai", "Bilaspur", "Korba", "Durg",
    "Rajnandgaon", "Jagdalpur", "Raigarh", "Ambikapur", "Mahasamund",
    "Dhamtari", "Chirmiri", "Kawardha", "Dongargarh",
  ],
  "Goa": [
    "Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda",
    "Bicholim", "Curchorem", "Sanquelim", "Cuncolim", "Canacona",
  ],
  "Gujarat": [
    "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar",
    "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Nadiad",
    "Morbi", "Mehsana", "Bharuch", "Navsari", "Valsad",
    "Porbandar", "Godhra", "Bhuj", "Surendranagar", "Gandhidham",
    "Vapi", "Palanpur", "Patan", "Dahod", "Botad",
  ],
  "Haryana": [
    "Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal",
    "Hisar", "Rohtak", "Sonipat", "Yamunanagar", "Panchkula",
    "Bhiwani", "Sirsa", "Rewari", "Jind", "Kurukshetra",
    "Kaithal", "Bahadurgarh", "Palwal", "Thanesar", "Narnaul",
  ],
  "Himachal Pradesh": [
    "Shimla", "Dharamshala", "Mandi", "Solan", "Kullu",
    "Manali", "Hamirpur", "Una", "Bilaspur", "Palampur",
    "Nahan", "Chamba", "Baddi", "Sundernagar",
  ],
  "Jharkhand": [
    "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar",
    "Hazaribagh", "Giridih", "Ramgarh", "Phusro", "Medininagar",
    "Chaibasa", "Dumka", "Chatra",
  ],
  "Karnataka": [
    "Bangalore", "Bengaluru", "Mysore", "Mysuru", "Hubli", "Dharwad",
    "Mangalore", "Mangaluru", "Belgaum", "Belagavi", "Gulbarga", "Kalaburagi",
    "Davangere", "Bellary", "Ballari", "Shimoga", "Shivamogga",
    "Tumkur", "Tumakuru", "Raichur", "Bidar", "Hospet", "Hosapete",
    "Hassan", "Udupi", "Chitradurga", "Mandya", "Chikmagalur",
    "Gadag", "Bagalkot", "Ranebennur", "Haveri", "Kolar",
  ],
  "Kerala": [
    "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam",
    "Palakkad", "Alappuzha", "Kannur", "Kottayam", "Malappuram",
    "Kasaragod", "Pathanamthitta", "Idukki", "Wayanad", "Ernakulam",
    "Guruvayoor", "Thalassery", "Perinthalmanna", "Mattancherry",
  ],
  "Madhya Pradesh": [
    "Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain",
    "Sagar", "Dewas", "Satna", "Ratlam", "Rewa",
    "Murwara", "Singrauli", "Burhanpur", "Khandwa", "Morena",
    "Bhind", "Chhindwara", "Guna", "Shivpuri", "Vidisha",
    "Damoh", "Mandsaur", "Hoshangabad", "Itarsi", "Neemuch",
  ],
  "Maharashtra": [
    "Mumbai", "Pune", "Nagpur", "Thane", "Nashik",
    "Aurangabad", "Solapur", "Kolhapur", "Amravati", "Navi Mumbai",
    "Sangli", "Jalgaon", "Akola", "Latur", "Dhule",
    "Ahmednagar", "Chandrapur", "Parbhani", "Ichalkaranji", "Jalna",
    "Nanded", "Satara", "Ratnagiri", "Panvel", "Kalyan",
    "Vasai-Virar", "Bhiwandi", "Malegaon", "Wardha", "Osmanabad",
  ],
  "Manipur": [
    "Imphal", "Thoubal", "Bishnupur", "Churachandpur", "Kakching",
  ],
  "Meghalaya": [
    "Shillong", "Tura", "Jowai", "Nongstoin", "Williamnagar",
  ],
  "Mizoram": [
    "Aizawl", "Lunglei", "Saiha", "Champhai", "Serchhip", "Kolasib",
  ],
  "Nagaland": [
    "Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha", "Zunheboto",
  ],
  "Odisha": [
    "Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur",
    "Puri", "Balasore", "Bhadrak", "Baripada", "Jharsuguda",
    "Jeypore", "Barbil", "Paradip", "Angul", "Dhenkanal",
  ],
  "Punjab": [
    "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda",
    "Mohali", "Pathankot", "Hoshiarpur", "Batala", "Moga",
    "Abohar", "Malerkotla", "Khanna", "Muktsar", "Barnala",
    "Rajpura", "Firozpur", "Kapurthala", "Faridkot", "Sangrur",
  ],
  "Rajasthan": [
    "Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer",
    "Udaipur", "Bhilwara", "Alwar", "Bharatpur", "Sikar",
    "Pali", "Sri Ganganagar", "Tonk", "Beawar", "Hanumangarh",
    "Kishangarh", "Nagaur", "Makrana", "Churu", "Bundi",
    "Chittorgarh", "Jhunjhunu", "Barmer", "Banswara", "Dungarpur",
  ],
  "Sikkim": [
    "Gangtok", "Namchi", "Gyalshing", "Mangan", "Rangpo", "Singtam",
  ],
  "Tamil Nadu": [
    "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem",
    "Tirunelveli", "Tiruppur", "Vellore", "Erode", "Thoothukudi",
    "Dindigul", "Thanjavur", "Ranipet", "Sivakasi", "Karur",
    "Nagercoil", "Kanchipuram", "Hosur", "Kumbakonam", "Cuddalore",
    "Ambur", "Rajapalayam", "Pudukkottai", "Vaniyambadi",
  ],
  "Telangana": [
    "Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam",
    "Ramagundam", "Mahbubnagar", "Nalgonda", "Adilabad", "Suryapet",
    "Miryalaguda", "Siddipet", "Mancherial", "Jagtial", "Kamareddy",
    "Medak", "Bhongir", "Bodhan", "Sangareddy", "Secunderabad",
  ],
  "Tripura": [
    "Agartala", "Dharmanagar", "Udaipur", "Kailashahar", "Belonia",
    "Ambassa", "Khowai", "Sabroom",
  ],
  "Uttar Pradesh": [
    "Lucknow", "Kanpur", "Agra", "Varanasi", "Meerut",
    "Prayagraj", "Ghaziabad", "Noida", "Bareilly", "Aligarh",
    "Moradabad", "Gorakhpur", "Saharanpur", "Jhansi", "Muzaffarnagar",
    "Mathura", "Firozabad", "Ayodhya", "Rampur", "Shahjahanpur",
    "Farrukhabad", "Loni", "Hapur", "Mirzapur", "Bulandshahr",
    "Sambhal", "Amroha", "Etawah", "Hardoi", "Fatehpur",
    "Rae Bareli", "Greater Noida",
  ],
  "Uttarakhand": [
    "Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur",
    "Kashipur", "Rishikesh", "Nainital", "Pithoragarh", "Kotdwar",
    "Mussoorie", "Almora", "Tehri", "Pauri",
  ],
  "West Bengal": [
    "Kolkata", "Howrah", "Asansol", "Siliguri", "Durgapur",
    "Bardhaman", "Malda", "Baharampur", "Habra", "Kharagpur",
    "Shantipur", "Dankuni", "Dhulian", "Ranaghat", "Haldia",
    "Raiganj", "Krishnanagar", "Nabadwip", "Medinipur", "Jalpaiguri",
    "Balurghat", "Basirhat", "Bankura", "Purulia", "Darjeeling",
  ],
  "Andaman and Nicobar Islands": [
    "Port Blair", "Bamboo Flat", "Garacharma",
  ],
  "Chandigarh": ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": [
    "Silvassa", "Daman", "Diu",
  ],
  "Delhi": [
    "New Delhi", "Delhi", "Dwarka", "Rohini", "Saket",
    "Karol Bagh", "Lajpat Nagar", "Pitampura", "Janakpuri",
  ],
  "Jammu and Kashmir": [
    "Srinagar", "Jammu", "Anantnag", "Baramulla", "Sopore",
    "Kathua", "Udhampur", "Kupwara", "Pulwama", "Rajouri",
  ],
  "Ladakh": ["Leh", "Kargil"],
  "Lakshadweep": ["Kavaratti", "Agatti", "Minicoy"],
  "Puducherry": ["Puducherry", "Karaikal", "Mahe", "Yanam"],
};

/** Flat list of all cities (for validation fallback). */
export const ALL_CITIES: string[] = Object.values(CITIES_BY_STATE).flat();
