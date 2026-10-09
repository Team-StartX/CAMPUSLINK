import type { DirectoryOption } from '../types/directory';

const companies = [
  ['Tata Consultancy Services', 'TCS Tata Consulting'],
  ['Tata Consumer Products', 'Tata Consumer'],
  ['Tata Motors', ''],
  ['Tata Steel', ''],
  ['Infosys', ''],
  ['Wipro', ''],
  ['HCLTech', 'HCL Technologies'],
  ['Tech Mahindra', ''],
  ['Accenture', ''],
  ['Cognizant', 'CTS'],
  ['Capgemini', ''],
  ['Deloitte', ''],
  ['IBM', 'International Business Machines'],
  ['Microsoft', ''],
  ['Google', ''],
  ['Amazon', ''],
  ['Oracle', ''],
  ['SAP', ''],
  ['Reliance Industries', ''],
  ['Larsen & Toubro', 'L&T'],
];
const universities = [
  ['Indian Institute of Technology Bombay', 'IIT Bombay Mumbai'],
  ['Indian Institute of Technology Delhi', 'IIT Delhi'],
  ['Indian Institute of Technology Madras', 'IIT Madras Chennai'],
  ['Indian Institute of Technology Kanpur', 'IIT Kanpur'],
  ['Indian Institute of Technology Kharagpur', 'IIT Kharagpur'],
  ['Indian Institute of Technology Roorkee', 'IIT Roorkee'],
  ['Indian Institute of Technology Guwahati', 'IIT Guwahati'],
  ['Indian Institute of Technology Bhubaneswar', 'IIT Bhubaneswar'],
  ['National Institute of Technology Rourkela', 'NIT Rourkela'],
  ['National Institute of Technology Tiruchirappalli', 'NIT Trichy'],
  ['National Institute of Technology Warangal', 'NIT Warangal'],
  ['National Institute of Technology Karnataka', 'NIT Surathkal'],
  ['Delhi Technological University', 'DTU'],
  ['University of Delhi', 'Delhi University DU'],
  ['Birla Institute of Technology and Science Pilani', 'BITS Pilani'],
  ['Vellore Institute of Technology', 'VIT Vellore'],
  ['SRM Institute of Science and Technology', 'SRM University'],
  ['KIIT University', 'Kalinga Institute of Industrial Technology'],
  ['Siksha O Anusandhan', 'SOA ITER Bhubaneswar'],
  ['Utkal University', ''],
  ['Odisha University of Technology and Research', 'OUTR CET Bhubaneswar'],
  ['Veer Surendra Sai University of Technology', 'VSSUT Burla'],
  ['Anna University', ''],
  ['Jadavpur University', ''],
  ['Amity University', ''],
  ['Manipal Academy of Higher Education', 'Manipal University MAHE'],
];
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function searchBuiltInDirectory(
  kind: 'universities' | 'companies',
  query: string,
  country = 'India',
): DirectoryOption[] {
  const search = normalize(query);
  if (search.length < 2 || (kind === 'universities' && country && country !== 'India'))
    return [];
  return (kind === 'universities' ? universities : companies)
    .filter(([name, aliases]) =>
      search.split(/\s+/).every((word) => normalize(`${name} ${aliases}`).includes(word)),
    )
    .slice(0, 12)
    .map(([name]) => ({
      id: `builtin:${kind}:${name}`,
      name,
      country: kind === 'universities' ? 'India' : undefined,
      source: 'PlacedIn',
    }));
}

export function mergeDirectoryOptions(primary: DirectoryOption[], fallback: DirectoryOption[]) {
  const names = new Set(primary.map((option) => normalize(option.name)));
  return [...primary, ...fallback.filter((option) => !names.has(normalize(option.name)))].slice(0, 12);
}
