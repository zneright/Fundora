/**
 * Fundora — PSGC Geographic Cascading Hook (`usePsgcGeographicSelector`)
 * Implements the full Region -> Province -> City/Municipality -> Barangay
 * cascading hierarchy per FD-SDLC-08 Section 4:
 * - Queries official PSGC API with a 3-second AbortController timeout
 * - Automatically falls back to bundled `src/data/psgcFallback.json` offline or on timeout
 * - Handles the NCR empty-provinces special case by injecting virtual province
 *   `Metro Manila` (`130000000-MM`) and fetching `/regions/{code}/cities-municipalities`
 * - Resolves 10-digit canonical `psgcCode` and default ZIP code
 */

import { useState, useEffect, useCallback } from 'react';
import psgcFallback from '../data/psgcFallback.json';
import { APP_CONFIG } from '../configuration/config';

export interface PsgcRegionOption {
  code: string;
  name: string;
  regionName?: string;
}

export interface PsgcProvinceOption {
  code: string;
  name: string;
  regionCode: string;
  isNcrVirtual?: boolean;
}

export interface PsgcCityMunicipalityOption {
  code: string;
  name: string;
  provinceCode: string;
  zipCode?: string;
}

export interface PsgcBarangayOption {
  code: string;
  name: string;
  cityMunicipalityCode: string;
  zipCode?: string;
}

async function fetchWithTimeout<T>(url: string, timeoutMs = APP_CONFIG.psgc.timeoutMs): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`PSGC HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeTo10DigitPsgc(rawCode: string): string {
  const digits = rawCode.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 9) return `${digits}0`;
  return digits.padEnd(10, '0').slice(0, 10);
}

export function usePsgcGeographicSelector(initialValues?: {
  regionCode?: string;
  provinceCode?: string;
  cityMunicipalityCode?: string;
  barangayCode?: string;
}) {
  const [regions, setRegions] = useState<PsgcRegionOption[]>(psgcFallback.regions);
  const [provinces, setProvinces] = useState<PsgcProvinceOption[]>([]);
  const [citiesMunicipalities, setCitiesMunicipalities] = useState<PsgcCityMunicipalityOption[]>([]);
  const [barangays, setBarangays] = useState<PsgcBarangayOption[]>([]);

  const [selectedRegionCode, setSelectedRegionCode] = useState<string>(
    initialValues?.regionCode || ''
  );
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>(
    initialValues?.provinceCode || ''
  );
  const [selectedCityMunicipalityCode, setSelectedCityMunicipalityCode] = useState<string>(
    initialValues?.cityMunicipalityCode || ''
  );
  const [selectedBarangayCode, setSelectedBarangayCode] = useState<string>(
    initialValues?.barangayCode || ''
  );

  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<
    'idle' | 'regions' | 'provinces' | 'cities' | 'barangays'
  >('idle');

  // 1. Load Regions
  useEffect(() => {
    let active = true;
    async function loadRegions() {
      setLoadingStage('regions');
      try {
        const data = await fetchWithTimeout<Array<{ code: string; name: string; regionName?: string }>>(
          `${APP_CONFIG.psgc.apiBaseUrl}/regions/`
        );
        if (active && Array.isArray(data) && data.length > 0) {
          setRegions(data);
          setIsOfflineFallback(false);
        }
      } catch {
        if (active) {
          setRegions(psgcFallback.regions);
          setIsOfflineFallback(true);
        }
      } finally {
        if (active) setLoadingStage('idle');
      }
    }
    loadRegions();
    return () => {
      active = false;
    };
  }, []);

  // 2. Load Provinces when Region changes (with NCR empty-province handling)
  useEffect(() => {
    if (!selectedRegionCode) {
      setProvinces([]);
      return;
    }

    let active = true;
    async function loadProvincesForRegion(regCode: string) {
      setLoadingStage('provinces');
      try {
        const data = await fetchWithTimeout<Array<{ code: string; name: string }>>(
          `${APP_CONFIG.psgc.apiBaseUrl}/regions/${regCode}/provinces/`
        );
        if (!active) return;

        // NCR Special Case: PSGC `/regions/130000000/provinces/` returns `[]`
        if (!Array.isArray(data) || data.length === 0) {
          const virtualNcr: PsgcProvinceOption = {
            code: `${regCode}-MM`,
            name: 'Metro Manila',
            regionCode: regCode,
            isNcrVirtual: true,
          };
          setProvinces([virtualNcr]);
          setSelectedProvinceCode(virtualNcr.code);
        } else {
          setProvinces(
            data.map((p) => ({
              code: p.code,
              name: p.name,
              regionCode: regCode,
            }))
          );
        }
      } catch {
        if (!active) return;
        setIsOfflineFallback(true);
        const fallbackList =
          (psgcFallback.provincesByRegion as Record<string, PsgcProvinceOption[]>)[regCode] || [];
        setProvinces(fallbackList);
        if (fallbackList.length === 1 && fallbackList[0].isNcrVirtual) {
          setSelectedProvinceCode(fallbackList[0].code);
        }
      } finally {
        if (active) setLoadingStage('idle');
      }
    }

    loadProvincesForRegion(selectedRegionCode);
    return () => {
      active = false;
    };
  }, [selectedRegionCode]);

  // 3. Load Cities / Municipalities when Province changes
  useEffect(() => {
    if (!selectedProvinceCode) {
      setCitiesMunicipalities([]);
      return;
    }

    let active = true;
    async function loadCitiesForProvince(provCode: string) {
      setLoadingStage('cities');
      const isNcr = provCode.endsWith('-MM') || selectedRegionCode.startsWith('13');
      const fallbackCities =
        (
          psgcFallback.citiesMunicipalitiesByProvince as Record<
            string,
            PsgcCityMunicipalityOption[]
          >
        )[provCode] || [];

      try {
        const endpoint = isNcr
          ? `${APP_CONFIG.psgc.apiBaseUrl}/regions/${selectedRegionCode}/cities-municipalities/`
          : `${APP_CONFIG.psgc.apiBaseUrl}/provinces/${provCode}/cities-municipalities/`;

        const data = await fetchWithTimeout<Array<{ code: string; name: string }>>(endpoint);
        if (!active) return;

        if (Array.isArray(data) && data.length > 0) {
          setCitiesMunicipalities(
            data.map((c) => {
              const matchedFallback = fallbackCities.find(
                (fc) => fc.code === c.code || fc.name.toLowerCase() === c.name.toLowerCase()
              );
              return {
                code: c.code,
                name: c.name,
                provinceCode: provCode,
                zipCode: matchedFallback?.zipCode,
              };
            })
          );
        } else {
          setCitiesMunicipalities(fallbackCities);
        }
      } catch {
        if (!active) return;
        setIsOfflineFallback(true);
        setCitiesMunicipalities(fallbackCities);
      } finally {
        if (active) setLoadingStage('idle');
      }
    }

    loadCitiesForProvince(selectedProvinceCode);
    return () => {
      active = false;
    };
  }, [selectedProvinceCode, selectedRegionCode]);

  // 4. Load Barangays when City/Municipality changes
  useEffect(() => {
    if (!selectedCityMunicipalityCode) {
      setBarangays([]);
      return;
    }

    let active = true;
    async function loadBarangaysForCity(cityCode: string) {
      setLoadingStage('barangays');
      const fallbackBrgys =
        (
          psgcFallback.barangaysByCityMunicipality as Record<string, PsgcBarangayOption[]>
        )[cityCode] || [];

      try {
        const data = await fetchWithTimeout<Array<{ code: string; name: string }>>(
          `${APP_CONFIG.psgc.apiBaseUrl}/cities-municipalities/${cityCode}/barangays/`
        );
        if (!active) return;

        if (Array.isArray(data) && data.length > 0) {
          setBarangays(
            data.map((b) => {
              const canonCode = normalizeTo10DigitPsgc(b.code);
              const matchedFallback = fallbackBrgys.find(
                (fb) =>
                  normalizeTo10DigitPsgc(fb.code) === canonCode ||
                  fb.name.toLowerCase() === b.name.toLowerCase()
              );
              return {
                code: canonCode,
                name: b.name,
                cityMunicipalityCode: cityCode,
                zipCode: matchedFallback?.zipCode,
              };
            })
          );
        } else {
          setBarangays(fallbackBrgys);
        }
      } catch {
        if (!active) return;
        setIsOfflineFallback(true);
        setBarangays(fallbackBrgys);
      } finally {
        if (active) setLoadingStage('idle');
      }
    }

    loadBarangaysForCity(selectedCityMunicipalityCode);
    return () => {
      active = false;
    };
  }, [selectedCityMunicipalityCode]);

  const selectRegion = useCallback((regionCode: string) => {
    setSelectedRegionCode(regionCode);
    setSelectedProvinceCode('');
    setSelectedCityMunicipalityCode('');
    setSelectedBarangayCode('');
  }, []);

  const selectProvince = useCallback((provinceCode: string) => {
    setSelectedProvinceCode(provinceCode);
    setSelectedCityMunicipalityCode('');
    setSelectedBarangayCode('');
  }, []);

  const selectCityMunicipality = useCallback((cityCode: string) => {
    setSelectedCityMunicipalityCode(cityCode);
    setSelectedBarangayCode('');
  }, []);

  const selectBarangay = useCallback((barangayCode: string) => {
    setSelectedBarangayCode(normalizeTo10DigitPsgc(barangayCode));
  }, []);

  const selectedRegion = regions.find((r) => r.code === selectedRegionCode) || null;
  const selectedProvince = provinces.find((p) => p.code === selectedProvinceCode) || null;
  const selectedCityMunicipality =
    citiesMunicipalities.find((c) => c.code === selectedCityMunicipalityCode) || null;
  const selectedBarangay =
    barangays.find((b) => normalizeTo10DigitPsgc(b.code) === selectedBarangayCode) || null;

  const resolvedZipCode =
    selectedBarangay?.zipCode || selectedCityMunicipality?.zipCode || '';

  return {
    regions,
    provinces,
    citiesMunicipalities,
    barangays,
    selectedRegionCode,
    selectedProvinceCode,
    selectedCityMunicipalityCode,
    selectedBarangayCode,
    selectedRegion,
    selectedProvince,
    selectedCityMunicipality,
    selectedBarangay,
    resolvedZipCode,
    isOfflineFallback,
    loadingStage,
    selectRegion,
    selectProvince,
    selectCityMunicipality,
    selectBarangay,
  };
}
