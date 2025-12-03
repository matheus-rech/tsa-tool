import { Study, TSAParams } from '@/types';

export const exampleStudies: Study[] = [
  { id: '1', name: 'Maud (b)', year: 2019, eventsTrt: 0, totalTrt: 10, eventsCtrl: 0, totalCtrl: 10 },
  { id: '2', name: 'Munich', year: 2020, eventsTrt: 0, totalTrt: 44, eventsCtrl: 7, totalCtrl: 129 },
  { id: '3', name: 'Phillips', year: 2021, eventsTrt: 0, totalTrt: 130, eventsCtrl: 16, totalCtrl: 245 },
  { id: '4', name: 'Siddiqui', year: 2021, eventsTrt: 1, totalTrt: 93, eventsCtrl: 5, totalCtrl: 129 },
  { id: '5', name: 'Barranco-Pons', year: 2022, eventsTrt: 1, totalTrt: 64, eventsCtrl: 38, totalCtrl: 768 },
  { id: '6', name: 'Maud (a)', year: 2022, eventsTrt: 0, totalTrt: 13, eventsCtrl: 0, totalCtrl: 13 },
  { id: '7', name: 'Waqas', year: 2022, eventsTrt: 3, totalTrt: 30, eventsCtrl: 1, totalCtrl: 63 },
  { id: '8', name: 'Verhey', year: 2023, eventsTrt: 0, totalTrt: 39, eventsCtrl: 2, totalCtrl: 136 },
  { id: '9', name: 'Hernandez', year: 2024, eventsTrt: 7, totalTrt: 58, eventsCtrl: 2, totalCtrl: 58 },
  { id: '10', name: 'Silva', year: 2024, eventsTrt: 19, totalTrt: 282, eventsCtrl: 179, totalCtrl: 1976 }
];

export const exampleParams: TSAParams = {
  alpha: 0.05,
  beta: 0.20,
  controlRate: 0.07,
  effectSize: 50,
  heterogeneityCorrection: 1.5
};

export const exampleDataSets = [
  {
    name: 'TRA vs TFA - Access Site Complications',
    description: 'Transradial vs transfemoral access for mechanical thrombectomy: access site complications outcome',
    studies: exampleStudies,
    params: exampleParams
  },
  {
    name: 'Hypothermia in Cardiac Arrest',
    description: 'Therapeutic hypothermia for neuroprotection after cardiac arrest',
    studies: [
      { id: '1', name: 'Bernard', year: 2002, eventsTrt: 21, totalTrt: 43, eventsCtrl: 9, totalCtrl: 34 },
      { id: '2', name: 'HACA', year: 2002, eventsTrt: 75, totalTrt: 137, eventsCtrl: 54, totalCtrl: 138 },
      { id: '3', name: 'Hachimi-Idrissi', year: 2001, eventsTrt: 4, totalTrt: 16, eventsCtrl: 2, totalCtrl: 17 },
      { id: '4', name: 'Mori', year: 2000, eventsTrt: 2, totalTrt: 18, eventsCtrl: 1, totalCtrl: 18 }
    ] as Study[],
    params: {
      alpha: 0.05,
      beta: 0.20,
      controlRate: 0.35,
      effectSize: 25,
      heterogeneityCorrection: 1.2
    } as TSAParams
  },
  {
    name: 'Corticosteroids in COVID-19',
    description: 'Corticosteroids for severe COVID-19: mortality outcome',
    studies: [
      { id: '1', name: 'RECOVERY', year: 2020, eventsTrt: 482, totalTrt: 2104, eventsCtrl: 1110, totalCtrl: 4321 },
      { id: '2', name: 'REMAP-CAP', year: 2020, eventsTrt: 98, totalTrt: 283, eventsCtrl: 137, totalCtrl: 303 },
      { id: '3', name: 'CoDEX', year: 2020, eventsTrt: 85, totalTrt: 151, eventsCtrl: 91, totalCtrl: 148 },
      { id: '4', name: 'CAPE COVID', year: 2020, eventsTrt: 16, totalTrt: 76, eventsCtrl: 21, totalCtrl: 73 },
      { id: '5', name: 'Steroids-SARI', year: 2020, eventsTrt: 26, totalTrt: 47, eventsCtrl: 33, totalCtrl: 53 }
    ] as Study[],
    params: {
      alpha: 0.05,
      beta: 0.10,
      controlRate: 0.28,
      effectSize: 20,
      heterogeneityCorrection: 1.3
    } as TSAParams
  }
];
