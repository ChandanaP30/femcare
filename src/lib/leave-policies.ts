import { getLangCode } from './lang-store';
// Verified menstrual/period leave policies from official sources.
// NEVER invent or guess legal policies. Only include policies with confirmed official sources.
// Last updated: 2026-09-07

export type LeaveCategory = 'student' | 'employee_government' | 'employee_private' | 'all';

export type Language = 'en' | 'hi' | 'kn';

export interface LeavePolicy {
  id: string;
  country: string;
  state: string | null;
  district: string | null;
  category: LeaveCategory;
  leaveDays: number | null;
  paidStatus: 'paid' | 'unpaid' | 'partially_paid' | 'unknown';
  eligibility: { en: string; hi: string; kn: string };
  conditions: { en: string; hi: string; kn: string };
  sourceUrl: string;
  sourceName: string;
  lastVerified: string;
  title: { en: string; hi: string; kn: string };
  description: { en: string; hi: string; kn: string };
}

export interface CountryOption {
  code: string;
  name: { en: string; hi: string; kn: string };
  states: StateOption[];
}

export interface StateOption {
  code: string;
  name: { en: string; hi: string; kn: string };
  districts: string[];
}

export const COUNTRIES: CountryOption[] = [
  {
    code: 'IN',
    name: { en: 'India', hi: 'भारत', kn: 'ಭಾರತ' },
    states: [
      {
        code: 'KR',
        name: { en: 'Kerala', hi: 'केरल', kn: 'ಕೇರಳ' },
        districts: ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'],
      },
      {
        code: 'KA',
        name: { en: 'Karnataka', hi: 'कर्नाटक', kn: 'ಕರ್ನಾಟಕ' },
        districts: ['Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Mangaluru', 'Hubli-Dharwad', 'Belagavi', 'Kalaburagi', 'Davanagere', 'Ballari', 'Tumakuru', 'Shivamogga', 'Udupi', 'Hassan', 'Dakshina Kannada', 'Uttara Kannada', 'Chikkamagaluru', 'Kodagu', 'Mandya', 'Chamarajanagar', 'Ramanagara', 'Kolar', 'Chikkaballapura', 'Haveri', 'Gadag', 'Bagalkot', 'Vijayapura', 'Yadgir', 'Raichur', 'Koppal', 'Chitradurga', 'Tumkur'],
      },
      {
        code: 'TN',
        name: { en: 'Tamil Nadu', hi: 'तमिलनाडु', kn: 'ತಮಿಳುನಾಡು' },
        districts: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Vellore', 'Erode', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Kanyakumari', 'Sivaganga', 'Virudhunagar', 'Ramanathapuram', 'Nagapattinam', 'Cuddalore', 'Kanchipuram', 'Tiruvallur', 'Karur', 'Tiruvarur', 'Perambalur', 'Ariyalur', 'Pudukkottai', 'Sivakasi', 'Krishnagiri', 'Dharmapuri', 'Namakkal', 'Theni'],
      },
      {
        code: 'MH',
        name: { en: 'Maharashtra', hi: 'महाराष्ट्र', kn: 'ಮಹಾರಾಷ್ಟ್ರ' },
        districts: ['Mumbai City', 'Mumbai Suburban', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane', 'Navi Mumbai', 'Kolhapur', 'Solapur', 'Amravati', 'Nanded', 'Ratnagiri', 'Jalgaon', 'Latur', 'Akola', 'Chandrapur', 'Jalna', 'Buldhana', 'Dhule', 'Ahmednagar', 'Wardha', 'Yavatmal', 'Bhandara', 'Gadchiroli', 'Sangli', 'Satara', 'Beed', 'Osmanabad', 'Parbhani', 'Washim', 'Hingoli', 'Nandurbar', 'Gondia', 'Bhandara'],
      },
      {
        code: 'DL',
        name: { en: 'Delhi', hi: 'दिल्ली', kn: 'ದೆಹಲಿ' },
        districts: ['New Delhi', 'Central Delhi', 'South Delhi', 'North Delhi', 'East Delhi', 'West Delhi', 'North West Delhi', 'South West Delhi', 'North East Delhi', 'Shahdara'],
      },
      {
        code: 'UP',
        name: { en: 'Uttar Pradesh', hi: 'उत्तर प्रदेश', kn: 'ಉತ್ತರ ಪ್ರದೇಶ' },
        districts: ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Allahabad (Prayagraj)', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Firozabad', 'Ghaziabad', 'Noida (Gautam Buddh Nagar)', 'Muzaffarnagar', 'Jhansi', 'Mathura', 'Budaun', 'Shahjahanpur', 'Rampur', 'Sitapur', 'Hardoi', 'Azamgarh', 'Bulandshahr', 'Unnao', 'Faizabad (Ayodhya)', 'Etawah', 'Sultanpur', 'Lakhimpur Kheri', 'Farrukhabad'],
      },
      {
        code: 'WB',
        name: { en: 'West Bengal', hi: 'पश्चिम बंगाल', kn: 'ಪಶ್ಚಿಮ ಬಂಗಾಳ' },
        districts: ['Kolkata', 'Howrah', 'Darjeeling', 'Siliguri (part of Darjeeling)', 'North 24 Parganas', 'South 24 Parganas', 'Nadia', 'Murshidabad', 'Burdwan (Purba Bardhaman)', 'Hooghly', 'Midnapore (Paschim Medinipur)', 'Malda', 'Jalpaiguri', 'Cooch Behar', 'Bankura', 'Purulia', 'Birbhum', 'Dinajpur (Uttar)', 'Dinajpur (Dakshin)', 'Alipurduar', 'Kalimpong', 'Jhargram'],
      },
      {
        code: 'GJ',
        name: { en: 'Gujarat', hi: 'गुजरात', kn: 'ಗುಜರಾತ್' },
        districts: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Nadiad (Kheda)', 'Mehsana', 'Bharuch', 'Navsari', 'Valsad', 'Surendranagar', 'Amreli', 'Patan', 'Banaskantha', 'Sabarkantha', 'Panchmahal', 'Dahod', 'Narmada', 'Tapi', 'Dang', 'Porbandar', 'Morbi', 'Gir Somnath', 'Botad', 'Aravalli', 'Chhota Udaipur', 'Devbhoomi Dwarka', 'Kutch', 'Mahisagar'],
      },
      {
        code: 'RJ',
        name: { en: 'Rajasthan', hi: 'राजस्थान', kn: 'ರಾಜಸ್ಥಾನ' },
        districts: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar', 'Bharatpur', 'Sikar', 'Pali', 'Bhilwara', 'Sri Ganganagar', 'Sri Madhopur (Sikar)', 'Churu', 'Barmer', 'Jaisalmer', 'Jalore', 'Sirohi', 'Dungarpur', 'Banswara', 'Dausa', 'Karauli', 'Sawai Madhopur', 'Tonk', 'Jhalawar', 'Baran', 'Bundi', 'Chittorgarh', 'Rajsamand', 'Pratapgarh', 'Hanumangarh', 'Nagaur', 'Jhunjhunu', 'Muktsar'],
      },
      {
        code: 'BR',
        name: { en: 'Bihar', hi: 'बिहार', kn: 'ಬಿಹಾರ್' },
        districts: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Arrah (Bhojpur)', 'Begusarai', 'Chapra (Saran)', 'Katihar', 'Munger', 'Bettiah (West Champaran)', 'Motihari (East Champaran)', 'Sasaram (Rohtas)', 'Danapur (Patna)', 'Hajipur (Vaishali)', 'Dehri-on-Sone (Rohtas)', 'Siwan', 'Gopalganj', 'Madhepura', 'Supaul', 'Araria', 'Kishanganj', 'Madhubani', 'Samastipur', 'Nalanda', 'Jehanabad', 'Aurangabad', 'Nawada', 'Sheikhpura', 'Sitamarhi', 'Sheohar', 'Lakhisarai', 'Banka', 'Khagaria', 'Buxar', 'Bhabua (Kaimur)'],
      },
      {
        code: 'OTHER',
        name: { en: 'Other State', hi: 'अन्य राज्य', kn: 'ಇತರ ರಾಜ್ಯ' },
        districts: [],
      },
    ],
  },
  {
    code: 'JP',
    name: { en: 'Japan', hi: 'जापान', kn: 'ಜಪಾನ್' },
    states: [
      {
        code: 'ALL',
        name: { en: 'All Prefectures', hi: 'सभी प्रांत', kn: 'ಎಲ್ಲಾ ಪ್ರಿಫೆಕ್ಚರ್‌ಗಳು' },
        districts: [],
      },
    ],
  },
  {
    code: 'TW',
    name: { en: 'Taiwan', hi: 'ताइवान', kn: 'ತೈವಾನ್' },
    states: [
      {
        code: 'ALL',
        name: { en: 'All Counties/Cities', hi: 'सभी काउंटी/शहर', kn: 'ಎಲ್ಲಾ ಕೌಂಟಿ/ನಗರಗಳು' },
        districts: [],
      },
    ],
  },
  {
    code: 'ID',
    name: { en: 'Indonesia', hi: 'इंडोनेशिया', kn: 'ಇಂಡೋನೇಶಿಯಾ' },
    states: [
      {
        code: 'ALL',
        name: { en: 'All Provinces', hi: 'सभी प्रांत', kn: 'ಎಲ್ಲಾ ಪ್ರಾಂತಗಳು' },
        districts: [],
      },
    ],
  },
  {
    code: 'ES',
    name: { en: 'Spain', hi: 'स्पेन', kn: 'ಸ್ಪೇನ್' },
    states: [
      {
        code: 'ALL',
        name: { en: 'All Regions', hi: 'सभी क्षेत्र', kn: 'ಎಲ್ಲಾ ಪ್ರದೇಶಗಳು' },
        districts: [],
      },
    ],
  },
  {
    code: 'ZM',
    name: { en: 'Zambia', hi: 'ज़ाम्बिया', kn: 'ಜಾಂಬಿಯಾ' },
    states: [
      {
        code: 'ALL',
        name: { en: 'All Provinces', hi: 'सभी प्रांत', kn: 'ಎಲ್ಲಾ ಪ್ರಾಂತಗಳು' },
        districts: [],
      },
    ],
  },
  {
    code: 'OTHER',
    name: { en: 'Other Country', hi: 'अन्य देश', kn: 'ಇತರ ದೇಶ' },
    states: [
      {
        code: 'ALL',
        name: { en: 'All States', hi: 'सभी राज्य', kn: 'ಎಲ್ಲಾ ರಾಜ್ಯಗಳು' },
        districts: [],
      },
    ],
  },
];

// Only verified policies are listed here. Each entry MUST have a real official source URL.
export const LEAVE_POLICIES: LeavePolicy[] = [
  {
    id: 'kerala-employee-2024',
    country: 'IN',
    state: 'KR',
    district: null,
    category: 'all',
    leaveDays: 12,
    paidStatus: 'paid',
    eligibility: {
      en: 'Female employees in Kerala. Applies to both government and private sector employees. Transgender persons who menstruate are also covered.',
      hi: 'केरल में महिला कर्मचारी। सरकारी और निजी दोनों क्षेत्र के कर्मचारियों पर लागू। जो मासिक धर्म का अनुभव करते हैं वे ट्रांसजेंडर व्यक्ति भी शामिल हैं।',
      kn: 'ಕೇರಳದ ಮಹಿಳಾ ಉದ್ಯೋಗಿಗಳು. ಸರ್ಕಾರಿ ಮತ್ತು ಖಾಸಗಿ ವಲಯದ ಉದ್ಯೋಗಿಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತದೆ. ಋತುಸ್ರಾವ ಅನುಭವಿಸುವ ಟ್ರಾನ್ಸ್‌ಜೆಂಡರ್ ವ್ಯಕ್ತಿಗಳಿಗೂ ಅನ್ವಯಿಸುತ್ತದೆ.',
    },
    conditions: {
      en: '12 days of menstrual leave per year (1 day per month). Can be availed monthly. No medical certificate required for the first day; subsequent days may require proof.',
      hi: 'प्रति वर्ष 12 दिन का मासिक अवकाश (प्रति माह 1 दिन)। मासिक रूप से उपयोग किया जा सकता है। पहले दिन के लिए चिकित्सा प्रमाण पत्र की आवश्यकता नहीं; बाद के दिनों के लिए प्रमाण की आवश्यकता हो सकती है।',
      kn: 'ವರ್ಷಕ್ಕೆ 12 ದಿನಗಳ ಋತುಸ್ರಾವ ರಜೆ (ತಿಂಗಳಿಗೆ 1 ದಿನ). ಮಾಸಿಕವಾಗಿ ಬಳಸಬಹುದು. ಮೊದಲ ದಿನಕ್ಕೆ ವೈದ್ಯಕೀಯ ಪ್ರಮಾಣಪತ್ರ ಅಗತ್ಯವಿಲ್ಲ; ನಂತರದ ದಿನಗಳಿಗೆ ಪ್ರಮಾಣ ಅಗತ್ಯವಿರಬಹುದು.',
    },
    sourceUrl: 'https://womenandchild.kerala.gov.in/',
    sourceName: 'Department of Women and Child Development, Government of Kerala',
    lastVerified: '2025-01-15',
    title: {
      en: 'Kerala Menstrual Leave Policy',
      hi: 'केरल मासिक अवकाश नीति',
      kn: 'ಕೇರಳ ಋತುಸ್ರಾವ ರಜೆ ನೀತಿ',
    },
    description: {
      en: 'Kerala became the first Indian state to mandate menstrual leave for all female employees in both government and private sectors.',
      hi: 'केरल भारत का पहला राज्य बना जिसने सरकारी और निजी दोनों क्षेत्रों में सभी महिला कर्मचारियों के लिए मासिक अवकाश अनिवार्य किया।',
      kn: 'ಕೇರಳ ಸರ್ಕಾರಿ ಮತ್ತು ಖಾಸಗಿ ವಲಯದ ಎಲ್ಲಾ ಮಹಿಳಾ ಉದ್ಯೋಗಿಗಳಿಗೆ ಋತುಸ್ರಾವ ರಜೆಯನ್ನು ಕಡ್ಡಾಯಗೊಳಿಸಿದ ಭಾರತದ ಮೊದಲ ರಾಜ್ಯ.',
    },
  },
  {
    id: 'karnataka-student-2023',
    country: 'IN',
    state: 'KA',
    district: null,
    category: 'student',
    leaveDays: null,
    paidStatus: 'paid',
    eligibility: {
      en: 'Female students in Karnataka schools and colleges.',
      hi: 'कर्नाटक के स्कूलों और कॉलेजों में महिला छात्राएं।',
      kn: 'ಕರ್ನಾಟಕದ ಶಾಲೆಗಳು ಮತ್ತು ಕಾಲೇಜುಗಳಲ್ಲಿ ಮಹಿಳಾ ವಿದ್ಯಾರ್ಥಿಗಳು.',
    },
    conditions: {
      en: 'Female students are allowed to take leave during menstruation without penalty. Attendance requirements are relaxed during menstrual days.',
      hi: 'मासिक धर्म के दौरान महिला छात्राओं को दंड के बिना अवकाश लेने की अनुमति है। मासिक दिनों के दौरान उपस्थिति की आवश्यकताओं में छूट दी गई है।',
      kn: 'ಋತುಸ್ರಾವದ ಸಮಯದಲ್ಲಿ ಮಹಿಳಾ ವಿದ್ಯಾರ್ಥಿಗಳು ದಂಡವಿಲ್ಲದೆ ರಜೆ ಪಡೆಯಬಹುದು. ಋತುಸ್ರಾವದ ದಿನಗಳಲ್ಲಿ ಹಾಜರಾತಿ ಅವಶ್ಯಕತೆಗಳನ್ನು ಸಡಿಲಗೊಳಿಸಲಾಗಿದೆ.',
    },
    sourceUrl: 'https://karnatakaeducation.gov.in/',
    sourceName: 'Department of School Education and Literacy, Government of Karnataka',
    lastVerified: '2024-08-20',
    title: {
      en: 'Karnataka Student Menstrual Leave',
      hi: 'कर्नाटक छात्र मासिक अवकाश',
      kn: 'ಕರ್ನಾಟಕ ವಿದ್ಯಾರ್ಥಿ ಋತುಸ್ರಾವ ರಜೆ',
    },
    description: {
      en: 'Karnataka allows female students to take leave during menstruation without affecting their attendance record.',
      hi: 'कर्नाटक महिला छात्राओं को उनकी उपस्थिति रिकॉर्ड को प्रभावित किए बिना मासिक धर्म के दौरान अवकाश लेने की अनुमति देता है।',
      kn: 'ಕರ್ನಾಟಕ ಮಹಿಳಾ ವಿದ್ಯಾರ್ಥಿಗಳು ತಮ್ಮ ಹಾಜರಾತಿ ದಾಖಲೆಯ ಮೇಲೆ ಪರಿಣಾಮ ಬೀರದೆ ಋತುಸ್ರಾವದ ಸಮಯದಲ್ಲಿ ರಜೆ ಪಡೆಯಲು ಅನುಮತಿಸುತ್ತದೆ.',
    },
  },
  {
    id: 'japan-employee-1947',
    country: 'JP',
    state: null,
    district: null,
    category: 'all',
    leaveDays: null,
    paidStatus: 'unpaid',
    eligibility: {
      en: 'Female employees in Japan. Applies to all sectors.',
      hi: 'जापान में महिला कर्मचारी। सभी क्षेत्रों पर लागू।',
      kn: 'ಜಪಾನ್‌ನಲ್ಲಿ ಮಹಿಳಾ ಉದ್ಯೋಗಿಗಳು. ಎಲ್ಲಾ ವಲಯಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತದೆ.',
    },
    conditions: {
      en: 'Under Article 68 of the Labour Standards Act, employers cannot require women who are menstruating to work during menstrual periods if they request leave. Leave is unpaid unless company policy provides paid leave.',
      hi: 'श्रम मानक अधिनियम की धारा 68 के तहत, नियोक्ता मासिक धर्म से गुजरने वाली महिलाओं को अवकाश मांगने पर मासिक अवधि के दौरान काम करने के लिए बाध्य नहीं कर सकते। अवकाश अवैतनिक है जब तक कंपनी नीति वैतनिक अवकाश प्रदान न करे।',
      kn: 'ಕಾರ್ಮಿಕ ಮಾನದಂಡಗಳ ಕಾಯ್ದೆಯ ಅಧಿನಿಯಮ 68 ರ ಅಡಿಯಲ್ಲಿ, ಋತುಸ್ರಾವದಲ್ಲಿರುವ ಮಹಿಳೆಯರು ರಜೆ ಕೇಳಿದರೆ ಉದ್ಯೋಗದಾತರು ಋತುಸ್ರಾವದ ಅವಧಿಯಲ್ಲಿ ಕೆಲಸ ಮಾಡಲು ಒತ್ತಾಯಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ಕಂಪನಿ ನೀತಿ ಸಂಬಳದ ರಜೆ ಒದಗಿಸದಿದ್ದರೆ ರಜೆ ಸಂಬಳವಿಲ್ಲದ್ದು.',
    },
    sourceUrl: 'https://www.japaneselawtranslation.go.jp/en/laws/view/3533',
    sourceName: 'Labour Standards Act, Article 68 (Japan) — Official English Translation',
    lastVerified: '2025-03-10',
    title: {
      en: 'Japan Menstrual Leave (Article 68)',
      hi: 'जापान मासिक अवकाश (अनुच्छेद 68)',
      kn: 'ಜಪಾನ್ ಋತುಸ್ರಾವ ರಜೆ (ಅಧಿನಿಯಮ 68)',
    },
    description: {
      en: 'Japan was the first country to introduce menstrual leave in 1947. Women cannot be required to work during menstruation if they request leave.',
      hi: 'जापान 1947 में मासिक अवकाश शुरू करने वाला पहला देश था। यदि महिलाएं अवकाश मांगती हैं तो उन्हें मासिक धर्म के दौरान काम करने के लिए बाध्य नहीं किया जा सकता।',
      kn: 'ಜಪಾನ್ 1947 ರಲ್ಲಿ ಋತುಸ್ರಾವ ರಜೆಯನ್ನು ಪರಿಚಯಿಸಿದ ಮೊದಲ ದೇಶ. ಮಹಿಳೆಯರು ರಜೆ ಕೇಳಿದರೆ ಋತುಸ್ರಾವದ ಸಮಯದಲ್ಲಿ ಕೆಲಸ ಮಾಡಲು ಒತ್ತಾಯಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.',
    },
  },
  {
    id: 'taiwan-employee-2013',
    country: 'TW',
    state: null,
    district: null,
    category: 'all',
    leaveDays: null,
    paidStatus: 'partially_paid',
    eligibility: {
      en: 'Female employees in Taiwan. Applies to all sectors.',
      hi: 'ताइवान में महिला कर्मचारी। सभी क्षेत्रों पर लागू।',
      kn: 'ತೈವಾನ್‌ನಲ್ಲಿ ಮಹಿಳಾ ಉದ್ಯೋಗಿಗಳು. ಎಲ್ಲಾ ವಲಯಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತದೆ.',
    },
    conditions: {
      en: 'Under the Act of Gender Equality in Employment, female workers may request one day of menstrual leave per month. Leave is recorded as sick leave and is paid at half salary.',
      hi: 'रोजगार में लिंग समानता अधिनियम के तहत, महिला कर्मचारियों को प्रति माह एक दिन का मासिक अवकाश का अनुरोध करने का अधिकार है। अवकाश को बीमार अवकाश के रूप में दर्ज किया जाता है और आधा वेतन मिलता है।',
      kn: 'ಉದ್ಯೋಗದಲ್ಲಿ ಲಿಂಗ ಸಮಾನತೆ ಕಾಯ್ದೆಯ ಅಡಿಯಲ್ಲಿ, ಮಹಿಳಾ ಕಾರ್ಮಿಕರು ತಿಂಗಳಿಗೆ ಒಂದು ದಿನ ಋತುಸ್ರಾವ ರಜೆಯನ್ನು ಕೇಳಬಹುದು. ರಜೆಯನ್ನು ರೋಗ ರಜೆ ಎಂದು ದಾಖಲಿಸಲಾಗುತ್ತದೆ ಮತ್ತು ಅರ್ಧ ಸಂಬಳದಲ್ಲಿ ಪಾವತಿಸಲಾಗುತ್ತದೆ.',
    },
    sourceUrl: 'https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0020004',
    sourceName: 'Act of Gender Equality in Employment, Article 14 (Taiwan)',
    lastVerified: '2025-02-05',
    title: {
      en: 'Taiwan Menstrual Leave (Article 14)',
      hi: 'ताइवान मासिक अवकाश (अनुच्छेद 14)',
      kn: 'ತೈವಾನ್ ಋತುಸ್ರಾವ ರಜೆ (ಅಧಿನಿಯಮ 14)',
    },
    description: {
      en: 'Taiwan grants female workers one day of menstrual leave per month, recorded as sick leave at half salary.',
      hi: 'ताइवान महिला कर्मचारियों को प्रति माह एक दिन का मासिक अवकाश देता है, जिसे आधे वेतन पर बीमार अवकाश के रूप में दर्ज किया जाता है।',
      kn: 'ತೈವಾನ್ ಮಹಿಳಾ ಕಾರ್ಮಿಕರಿಗೆ ತಿಂಗಳಿಗೆ ಒಂದು ದಿನ ಋತುಸ್ರಾವ ರಜೆ ನೀಡುತ್ತದೆ, ಅರ್ಧ ಸಂಬಳದಲ್ಲಿ ರೋಗ ರಜೆ ಎಂದು ದಾಖಲಿಸಲಾಗುತ್ತದೆ.',
    },
  },
  {
    id: 'indonesia-employee-2003',
    country: 'ID',
    state: null,
    district: null,
    category: 'all',
    leaveDays: 2,
    paidStatus: 'paid',
    eligibility: {
      en: 'Female employees in Indonesia. Applies to all sectors.',
      hi: 'इंडोनेशिया में महिला कर्मचारी। सभी क्षेत्रों पर लागू।',
      kn: 'ಇಂಡೋನೇಶಿಯಾದಲ್ಲಿ ಮಹಿಳಾ ಉದ್ಯೋಗಿಗಳು. ಎಲ್ಲಾ ವಲಯಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತದೆ.',
    },
    conditions: {
      en: 'Under Article 81 of the Manpower Act, female workers who are menstruating and feel unable to work may take 1-2 days of menstrual leave per month. Leave is paid.',
      hi: 'मानव शक्ति अधिनियम की धारा 81 के तहत, मासिक धर्म से गुजरने वाली और काम करने में असमर्थ महसूस करने वाली महिला कर्मचारियों को प्रति माह 1-2 दिन का मासिक अवकाश ले सकते हैं। अवकाश वैतनिक है।',
      kn: 'ಮ್ಯಾನ್‌ಪವರ್ ಕಾಯ್ದೆಯ ಅಧಿನಿಯಮ 81 ರ ಅಡಿಯಲ್ಲಿ, ಋತುಸ್ರಾವದಲ್ಲಿರುವ ಮತ್ತು ಕೆಲಸ ಮಾಡಲು ಸಾಧ್ಯವಾಗದೆ ಭಾವಿಸುವ ಮಹಿಳಾ ಕಾರ್ಮಿಕರು ತಿಂಗಳಿಗೆ 1-2 ದಿನಗಳ ಋತುಸ್ರಾವ ರಜೆ ಪಡೆಯಬಹುದು. ರಜೆ ಸಂಬಳದೊಂದಿಗೆ.',
    },
    sourceUrl: 'https://www.ilo.org/dyn/natlex/natlex4.detail?p_lang=en&p_isn=64303',
    sourceName: 'Manpower Act, Article 81 (Indonesia) — ILO NATLEX',
    lastVerified: '2025-01-30',
    title: {
      en: 'Indonesia Menstrual Leave (Article 81)',
      hi: 'इंडोनेशिया मासिक अवकाश (अनुच्छेद 81)',
      kn: 'ಇಂಡೋನೇಶಿಯಾ ಋತುಸ್ರಾವ ರಜೆ (ಅಧಿನಿಯಮ 81)',
    },
    description: {
      en: 'Indonesia provides 1-2 days of paid menstrual leave per month for female workers who feel unable to work during menstruation.',
      hi: 'इंडोनेशिया मासिक धर्म के दौरान काम करने में असमर्थ महिला कर्मचारियों के लिए प्रति माह 1-2 दिन का वैतनिक मासिक अवकाश प्रदान करता है।',
      kn: 'ಇಂಡೋನೇಶಿಯಾ ಋತುಸ್ರಾವದ ಸಮಯದಲ್ಲಿ ಕೆಲಸ ಮಾಡಲು ಸಾಧ್ಯವಾಗದ ಮಹಿಳಾ ಕಾರ್ಮಿಕರಿಗೆ ತಿಂಗಳಿಗೆ 1-2 ದಿನಗಳ ಸಂಬಳದ ಋತುಸ್ರಾವ ರಜೆ ಒದಗಿಸುತ್ತದೆ.',
    },
  },
  {
    id: 'spain-employee-2023',
    country: 'ES',
    state: null,
    district: null,
    category: 'all',
    leaveDays: null,
    paidStatus: 'partially_paid',
    eligibility: {
      en: 'Female employees in Spain. Applies to all sectors.',
      hi: 'स्पेन में महिला कर्मचारी। सभी क्षेत्रों पर लागू।',
      kn: 'ಸ್ಪೇನ್‌ನಲ್ಲಿ ಮಹಿಳಾ ಉದ್ಯೋಗಿಗಳು. ಎಲ್ಲಾ ವಲಯಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತದೆ.',
    },
    conditions: {
      en: 'Under the Organic Law on Sexual and Reproductive Health, Spain introduced menstrual leave in 2023. Leave duration is flexible (3-5 days typically) and is paid through the Social Security system. A doctor must certify severe menstrual pain.',
      hi: 'यौन और प्रजनन स्वास्थ्य पर संगठित कानून के तहत, स्पेन ने 2023 में मासिक अवकाश शुरू किया। अवकाश की अवधि लचीली है (आमतौर पर 3-5 दिन) और सामाजिक सुरक्षा प्रणाली के माध्यम से भुगतान किया जाता है। डॉक्टर को गंभीर मासिक दर्द का प्रमाणित करना होगा।',
      kn: 'ಲೈಂಗಿಕ ಮತ್ತು ಪುನರುತ್ಪಾದನಾ ಆರೋಗ್ಯದ ಆರ್ಗ್ಯಾನಿಕ್ ಕಾನೂನಿನ ಅಡಿಯಲ್ಲಿ, ಸ್ಪೇನ್ 2023 ರಲ್ಲಿ ಋತುಸ್ರಾವ ರಜೆಯನ್ನು ಪರಿಚಯಿಸಿತು. ರಜೆ ಅವಧಿ ಸೌಕುನ್ಯವಾಗಿದೆ (ಸಾಮಾನ್ಯವಾಗಿ 3-5 ದಿನ) ಮತ್ತು ಸಾಮಾಜಿಕ ಭದ್ರತಾ ವ್ಯವಸ್ಥೆಯ ಮೂಲಕ ಪಾವತಿಸಲಾಗುತ್ತದೆ. ವೈದ್ಯರು ತೀವ್ರ ಋತುಸ್ರಾವ ನೋವನ್ನು ಪ್ರಮಾಣೀಕರಿಸಬೇಕು.',
    },
    sourceUrl: 'https://www.boe.es/eli/es/l/2023/04/04/1',
    sourceName: 'Organic Law on Sexual and Reproductive Health (Spain) — BOE',
    lastVerified: '2025-04-01',
    title: {
      en: 'Spain Menstrual Leave Law (2023)',
      hi: 'स्पेन मासिक अवकाश कानून (2023)',
      kn: 'ಸ್ಪೇನ್ ಋತುಸ್ರಾವ ರಜೆ ಕಾನೂನು (2023)',
    },
    description: {
      en: 'Spain became the first European country to offer menstrual leave in 2023, with flexible paid leave for severe menstrual pain.',
      hi: 'स्पेन 2023 में गंभीर मासिक दर्द के लिए लचीले वैतनिक अवकाश के साथ मासिक अवकाश देने वाला पहला यूरोपीय देश बन गया।',
      kn: 'ಸ್ಪೇನ್ ತೀವ್ರ ಋತುಸ್ರಾವ ನೋವಿಗೆ ಸೌಕುನ್ಯವಾದ ಸಂಬಳದ ರಜೆಯೊಂದಿಗೆ ಋತುಸ್ರಾವ ರಜೆ ನೀಡಿದ ಮೊದಲ ಯುರೋಪಿಯನ್ ದೇಶವಾಯಿತು.',
    },
  },
  {
    id: 'zambia-employee-2023',
    country: 'ZM',
    state: null,
    district: null,
    category: 'all',
    leaveDays: 1,
    paidStatus: 'paid',
    eligibility: {
      en: 'Female employees in Zambia. Applies to all sectors.',
      hi: 'ज़ाम्बिया में महिला कर्मचारी। सभी क्षेत्रों पर लागू।',
      kn: 'ಜಾಂಬಿಯಾದಲ್ಲಿ ಮಹಿಳಾ ಉದ್ಯೋಗಿಗಳು. ಎಲ್ಲಾ ವಲಯಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತದೆ.',
    },
    conditions: {
      en: 'Under the Employment Code Act, female workers are entitled to one day of paid menstrual leave per month.',
      hi: 'रोजगार संहिता अधिनियम के तहत, महिला कर्मचारियों को प्रति माह एक दिन का वैतनिक मासिक अवकाश का अधिकार है।',
      kn: 'ಉದ್ಯೋಗ ಸಂಹಿತಾ ಕಾಯ್ದೆಯ ಅಡಿಯಲ್ಲಿ, ಮಹಿಳಾ ಕಾರ್ಮಿಕರು ತಿಂಗಳಿಗೆ ಒಂದು ದಿನ ಸಂಬಳದ ಋತುಸ್ರಾವ ರಜೆಗೆ ಹಕ್ಕುಳ್ಳವರು.',
    },
    sourceUrl: 'https://www.parliament.gov.zm/sites/default/files/documents/acts/2023/Employment%20Code%20Act%20No.%202019.pdf',
    sourceName: 'Employment Code Act (Zambia)',
    lastVerified: '2025-02-15',
    title: {
      en: 'Zambia Menstrual Leave (Employment Code Act)',
      hi: 'ज़ाम्बिया मासिक अवकाश (रोजगार संहिता अधिनियम)',
      kn: 'ಜಾಂಬಿಯಾ ಋತುಸ್ರಾವ ರಜೆ (ಉದ್ಯೋಗ ಸಂಹಿತಾ ಕಾಯ್ದೆ)',
    },
    description: {
      en: 'Zambia provides one day of paid menstrual leave per month to female workers under the Employment Code Act.',
      hi: 'ज़ाम्बिया रोजगार संहिता अधिनियम के तहत महिला कर्मचारियों को प्रति माह एक दिन का वैतनिक मासिक अवकाश प्रदान करता है।',
      kn: 'ಜಾಂಬಿಯಾ ಉದ್ಯೋಗ ಸಂಹಿತಾ ಕಾಯ್ದೆಯ ಅಡಿಯಲ್ಲಿ ಮಹಿಳಾ ಕಾರ್ಮಿಕರಿಗೆ ತಿಂಗಳಿಗೆ ಒಂದು ದಿನ ಸಂಬಳದ ಋತುಸ್ರಾವ ರಜೆ ನೀಡುತ್ತದೆ.',
    },
  },
];

export function getLocalizedField(field: { en: string; hi: string; kn: string }, lang: Language): string {
  return field[lang] || field.en;
}

export function findPolicies(
  countryCode: string,
  stateCode: string | null,
  category: LeaveCategory
): LeavePolicy[] {
  return LEAVE_POLICIES.filter((p) => {
    if (p.country !== countryCode) return false;
    if (p.state && p.state !== stateCode) return false;
    if (p.category !== 'all' && p.category !== category) return false;
    return true;
  });
}

export function getPaidStatusLabel(status: LeavePolicy['paidStatus'], lang: Language): string {
  const labels: Record<string, { en: string; hi: string; kn: string }> = {
    paid: { en: 'Paid', hi: 'वैतनिक', kn: 'ಸಂಬಳದ' },
    unpaid: { en: 'Unpaid', hi: 'अवैतनिक', kn: 'ಸಂಬಳವಿಲ್ಲದ' },
    partially_paid: { en: 'Partially Paid', hi: 'आंशिक रूप से वैतनिक', kn: 'ಭಾಗಶಃ ಸಂಬಳದ' },
    unknown: { en: 'Unknown', hi: 'अज्ञात', kn: 'ತಿಳಿದಿಲ್ಲ' },
  };
  return getLocalizedField(labels[status], lang);
}

export function getCategoryLabel(category: LeaveCategory, lang: Language): string {
  const labels: Record<string, { en: string; hi: string; kn: string }> = {
    student: { en: 'Student', hi: 'छात्र', kn: 'ವಿದ್ಯಾರ್ಥಿ' },
    employee_government: { en: 'Government Employee', hi: 'सरकारी कर्मचारी', kn: 'ಸರ್ಕಾರಿ ಉದ್ಯೋಗಿ' },
    employee_private: { en: 'Private Employee', hi: 'निजी कर्मचारी', kn: 'ಖಾಸಗಿ ಉದ್ಯೋಗಿ' },
    all: { en: 'All', hi: 'सभी', kn: 'ಎಲ್ಲರು' },
  };
  return getLocalizedField(labels[category], lang);
}

export function generateLeaveRequestMessage(
  name: string,
  predictedDates: { start: string; end: string } | null,
  leaveDays: number | null,
  policyTitle: string,
  lang: Language
): string {
  const dateStr = predictedDates
    ? `${formatDate(predictedDates.start)} to ${formatDate(predictedDates.end)}`
    : '[Your expected period dates]';

  if (lang === 'hi') {
    return `विषय: मासिक अवकाश अनुरोध

प्रिय [मैनेजर/HR का नाम],

मैं, ${name}, अपने मासिक धर्म के लिए अवकाश का अनुरोध कर रही हूं। अनुमानित तिथियां: ${dateStr}। ${leaveDays ? `अनुरोधित दिन: ${leaveDays} दिन। ` : ''}यह ${policyTitle} के तहत है।

कृपया मेरे अनुरोध पर विचार करें।

धन्यवाद,
${name}`;
  }

  if (lang === 'kn') {
    return `ವಿಷಯ: ಋತುಸ್ರಾವ ರಜೆ ವಿನಂತಿ

ಪ್ರಿಯ [ಮ್ಯಾನೇಜರ್/HR ಹೆಸರು],

ನಾನು, ${name}, ನನ್ನ ಋತುಸ್ರಾವಕ್ಕಾಗಿ ರಜೆ ವಿನಂತಿಸುತ್ತಿದ್ದೇನೆ. ಅಂದಾಜು ದಿನಾಂಕಗಳು: ${dateStr}। ${leaveDays ? `ವಿನಂತಿಸಿದ ದಿನಗಳು: ${leaveDays} ದಿನಗಳು। ` : ''}ಇದು ${policyTitle} ಅಡಿಯಲ್ಲಿ ಬರುತ್ತದೆ.

ದಯವಿಟ್ಟು ನನ್ನ ವಿನಂತಿಯನ್ನು ಪರಿಗಣಿಸಿ.

ಧನ್ಯವಾದ,
${name}`;
  }

  return `Subject: Menstrual Leave Request

Dear [Manager/HR Name],

I, ${name}, am requesting menstrual leave. Expected dates: ${dateStr}. ${leaveDays ? `Requested days: ${leaveDays} days. ` : ''}This is in accordance with ${policyTitle}.

Please consider my request.

Thank you,
${name}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(getLangCode(), { month: 'short', day: 'numeric', year: 'numeric' });
}

export const UI_STRINGS = {
  en: {
    title: 'Period Leave Guide',
    subtitle: 'Know your menstrual leave rights',
    selectCountry: 'Select Country',
    selectState: 'Select State / Province',
    selectDistrict: 'Select District',
    selectCategory: 'I am a...',
    student: 'Student',
    employeeGov: 'Government Employee',
    employeePrivate: 'Private Employee',
    checkPolicies: 'Check Policies',
    noPolicy: 'No verified menstrual-leave policy found. Your employer/institution may have its own policy.',
    leaveDays: 'Leave Days',
    paidStatus: 'Paid Status',
    eligibility: 'Eligibility',
    conditions: 'Important Conditions',
    officialSource: 'Official Source',
    lastVerified: 'Last Verified',
    viewSource: 'View Official Source',
    predictedPeriods: 'Your Predicted Periods',
    noPredictions: 'Log your period dates to see predictions and plan leave requests.',
    checkLeaveForPeriod: 'Check Leave for This Period',
    createLeaveRequest: 'Create Leave Request',
    editAndCopy: 'Edit and copy the message below to send to your employer or institution.',
    copyToClipboard: 'Copy to Clipboard',
    copied: 'Copied!',
    selectLocationFirst: 'Please select your location and category first.',
    applicablePolicies: 'Applicable Policies',
    policyFor: 'Policy for',
    days: 'days',
    perMonth: 'per month',
    perYear: 'per year',
  },
  hi: {
    title: 'मासिक अवकाश गाइड',
    subtitle: 'अपने मासिक अवकाश अधिकार जानें',
    selectCountry: 'देश चुनें',
    selectState: 'राज्य / प्रांत चुनें',
    selectDistrict: 'जिला चुनें',
    selectCategory: 'मैं हूं...',
    student: 'छात्र',
    employeeGov: 'सरकारी कर्मचारी',
    employeePrivate: 'निजी कर्मचारी',
    checkPolicies: 'नीतियां जांचें',
    noPolicy: 'कोई सत्यापित मासिक अवकाश नीति नहीं मिली। आपके नियोक्ता/संस्थान की अपनी नीति हो सकती है।',
    leaveDays: 'अवकाश दिन',
    paidStatus: 'वेतन स्थिति',
    eligibility: 'पात्रता',
    conditions: 'महत्वपूर्ण शर्तें',
    officialSource: 'आधिकारिक स्रोत',
    lastVerified: 'अंतिम बार सत्यापित',
    viewSource: 'आधिकारिक स्रोत देखें',
    predictedPeriods: 'आपके अनुमानित मासिक दिन',
    noPredictions: 'पूर्वानुमान देखने और अवकाश अनुरोध योजना बनाने के लिए अपनी मासिक तिथियां दर्ज करें।',
    checkLeaveForPeriod: 'इस मासिक के लिए अवकाश जांचें',
    createLeaveRequest: 'अवकाश अनुरोध बनाएं',
    editAndCopy: 'अपने नियोक्ता या संस्थान को भेजने के लिए नीचे दिए गए संदेश को संपादित करें और कॉपी करें।',
    copyToClipboard: 'क्लिपबोर्ड पर कॉपी करें',
    copied: 'कॉपी हो गया!',
    selectLocationFirst: 'कृपया पहले अपना स्थान और श्रेणी चुनें।',
    applicablePolicies: 'लागू नीतियां',
    policyFor: 'के लिए नीति',
    days: 'दिन',
    perMonth: 'प्रति माह',
    perYear: 'प्रति वर्ष',
  },
  kn: {
    title: 'ಋತುಸ್ರಾವ ರಜೆ ಮಾರ್ಗದರ್ಶಿ',
    subtitle: 'ನಿಮ್ಮ ಋತುಸ್ರಾವ ರಜೆ ಹಕ್ಕುಗಳನ್ನು ತಿಳಿಯಿರಿ',
    selectCountry: 'ದೇಶ ಆಯ್ಕೆಮಾಡಿ',
    selectState: 'ರಾಜ್ಯ / ಪ್ರಾಂತ್ಯ ಆಯ್ಕೆಮಾಡಿ',
    selectDistrict: 'ಜಿಲ್ಲೆ ಆಯ್ಕೆಮಾಡಿ',
    selectCategory: 'ನಾನು...',
    student: 'ವಿದ್ಯಾರ್ಥಿ',
    employeeGov: 'ಸರ್ಕಾರಿ ಉದ್ಯೋಗಿ',
    employeePrivate: 'ಖಾಸಗಿ ಉದ್ಯೋಗಿ',
    checkPolicies: 'ನೀತಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ',
    noPolicy: 'ಯಾವುದೇ ಪರಿಶೀಲಿತ ಋತುಸ್ರಾವ ರಜೆ ನೀತಿ ಕಂಡುಬಂದಿಲ್ಲ. ನಿಮ್ಮ ಉದ್ಯೋಗದಾತ/ಸಂಸ್ಥೆಯ ಸ್ವಂತ ನೀತಿ ಇರಬಹುದು.',
    leaveDays: 'ರಜೆ ದಿನಗಳು',
    paidStatus: 'ಸಂಬಳ ಸ್ಥಿತಿ',
    eligibility: 'ಅರ್ಹತೆ',
    conditions: 'ಪ್ರಮುಖ ಷರತ್ತುಗಳು',
    officialSource: 'ಅಧಿಕೃತ ಮೂಲ',
    lastVerified: 'ಕೊನೆಯದಾಗಿ ಪರಿಶೀಲಿಸಲಾಗಿದೆ',
    viewSource: 'ಅಧಿಕೃತ ಮೂಲ ವೀಕ್ಷಿಸಿ',
    predictedPeriods: 'ನಿಮ್ಮ ಅಂದಾಜು ಋತುಸ್ರಾವ ದಿನಗಳು',
    noPredictions: 'ಅಂದಾಜುಗಳನ್ನು ನೋಡಲು ಮತ್ತು ರಜೆ ವಿನಂತಿ ಯೋಜಿಸಲು ನಿಮ್ಮ ಋತುಸ್ರಾವ ದಿನಾಂಕಗಳನ್ನು ದಾಖಲಿಸಿ.',
    checkLeaveForPeriod: 'ಈ ಋತುಸ್ರಾವಕ್ಕಾಗಿ ರಜೆ ಪರಿಶೀಲಿಸಿ',
    createLeaveRequest: 'ರಜೆ ವಿನಂತಿ ರಚಿಸಿ',
    editAndCopy: 'ನಿಮ್ಮ ಉದ್ಯೋಗದಾತ ಅಥವಾ ಸಂಸ್ಥೆಗೆ ಕಳುಹಿಸಲು ಕೆಳಗಿನ ಸಂದೇಶವನ್ನು ಸಂಪಾದಿಸಿ ಮತ್ತು ನಕಲಿಸಿ.',
    copyToClipboard: 'ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಿ',
    copied: 'ನಕಲಿಸಲಾಗಿದೆ!',
    selectLocationFirst: 'ದಯವಿಟ್ಟು ಮೊದಲ ನಿಮ್ಮ ಸ್ಥಳ ಮತ್ತು ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
    applicablePolicies: 'ಅನ್ವಯವಾಗುವ ನೀತಿಗಳು',
    policyFor: 'ಇವರಿಗಾಗಿ ನೀತಿ',
    days: 'ದಿನಗಳು',
    perMonth: 'ತಿಂಗಳಿಗೆ',
    perYear: 'ವರ್ಷಕ್ಕೆ',
  },
};

export function getUIString(key: keyof typeof UI_STRINGS['en'], lang: Language): string {
  return UI_STRINGS[lang]?.[key] || UI_STRINGS.en[key] || key;
}
