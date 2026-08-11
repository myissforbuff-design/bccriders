import React, { useState, useEffect } from 'react';
import { PH_ADDRESS_DATA, RegionData, ProvinceData, CityData, BarangayData } from '../data/phAddressData';
import { MapPin } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

export interface PhilippineAddressValue {
  regionCode: string;
  regionName: string;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  barangayCode: string;
  barangayName: string;
  streetAddress: string;
  fullAddressString: string;
}

interface PhilippineAddressSelectorProps {
  value?: Partial<PhilippineAddressValue>;
  onChange: (address: PhilippineAddressValue) => void;
  disabled?: boolean;
}

export const PhilippineAddressSelector: React.FC<PhilippineAddressSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>(value?.regionCode || '');
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>(value?.provinceCode || '');
  const [customProvince, setCustomProvince] = useState<string>(
    value?.provinceCode === 'OTHER' ? value?.provinceName || '' : ''
  );
  const [selectedCityCode, setSelectedCityCode] = useState<string>(value?.cityCode || '');
  const [customCity, setCustomCity] = useState<string>(
    value?.cityCode === 'OTHER' ? value?.cityName || '' : ''
  );
  const [selectedBarangayCode, setSelectedBarangayCode] = useState<string>(value?.barangayCode || '');
  const [customBarangay, setCustomBarangay] = useState<string>(
    value?.barangayCode === 'OTHER' ? value?.barangayName || '' : ''
  );
  const [streetAddress, setStreetAddress] = useState<string>(value?.streetAddress || '');

  // Derived objects from selections
  const selectedRegion = PH_ADDRESS_DATA.find((r) => r.code === selectedRegionCode);
  const isNCR = selectedRegion?.isNcR || false;

  const availableProvinces: ProvinceData[] = selectedRegion?.provinces || [];
  const selectedProvince = availableProvinces.find((p) => p.code === selectedProvinceCode);

  // Available cities: for NCR, cities come directly from region; otherwise from selected province
  const availableCities: CityData[] = isNCR
    ? selectedRegion?.cities || []
    : selectedProvince?.cities || [];
  const selectedCity = availableCities.find((c) => c.code === selectedCityCode);

  const availableBarangays: BarangayData[] = selectedCity?.barangays || [];
  const selectedBarangay = availableBarangays.find((b) => b.code === selectedBarangayCode);

  // Update parent whenever any field changes
  useEffect(() => {
    const rName = selectedRegion?.name || '';
    const pName = isNCR
      ? 'Metro Manila (NCR)'
      : selectedProvinceCode === 'OTHER'
      ? customProvince.trim()
      : selectedProvince?.name || '';
    const cName =
      selectedCityCode === 'OTHER'
        ? customCity.trim()
        : selectedCity?.name || '';

    let bName = '';
    if (selectedBarangayCode === 'OTHER') {
      bName = customBarangay.trim();
    } else {
      bName = selectedBarangay?.name || '';
    }

    // Construct full readable string
    const parts = [
      streetAddress.trim(),
      bName ? `Brgy. ${bName}` : '',
      cName,
      pName && pName !== cName ? pName : '',
      rName,
    ].filter(Boolean);

    const fullAddressString = parts.join(', ');

    onChange({
      regionCode: selectedRegionCode,
      regionName: rName,
      provinceCode: isNCR ? 'NCR' : selectedProvinceCode,
      provinceName: pName,
      cityCode: selectedCityCode,
      cityName: cName,
      barangayCode: selectedBarangayCode,
      barangayName: bName,
      streetAddress: streetAddress,
      fullAddressString,
    });
  }, [
    selectedRegionCode,
    selectedProvinceCode,
    customProvince,
    selectedCityCode,
    customCity,
    selectedBarangayCode,
    customBarangay,
    streetAddress,
  ]);

  // Handle Region Change
  const handleRegionChange = (regionCode: string) => {
    setSelectedRegionCode(regionCode);
    const regionObj = PH_ADDRESS_DATA.find((r) => r.code === regionCode);

    if (regionObj?.isNcR) {
      // Bypasses Province for NCR
      setSelectedProvinceCode('NCR');
    } else {
      setSelectedProvinceCode('');
    }

    setCustomProvince('');
    setSelectedCityCode('');
    setCustomCity('');
    setSelectedBarangayCode('');
    setCustomBarangay('');
  };

  // Handle Province Change
  const handleProvinceChange = (provCode: string) => {
    setSelectedProvinceCode(provCode);
    if (provCode !== 'OTHER') setCustomProvince('');
    setSelectedCityCode('');
    setCustomCity('');
    setSelectedBarangayCode('');
    setCustomBarangay('');
  };

  // Handle City Change
  const handleCityChange = (cityCode: string) => {
    setSelectedCityCode(cityCode);
    if (cityCode !== 'OTHER') setCustomCity('');
    setSelectedBarangayCode('');
    setCustomBarangay('');
  };

  // Options arrays for CustomSelect
  const regionOptions = PH_ADDRESS_DATA.map((r) => ({ value: r.code, label: r.name }));
  
  const provinceOptions = [
    ...availableProvinces.map((p) => ({ value: p.code, label: p.name })),
    ...(selectedRegionCode && !isNCR
      ? [{ value: 'OTHER', label: '➕ Other / Enter Custom Province...' }]
      : []),
  ];

  const cityOptions = [
    ...availableCities.map((c) => ({ value: c.code, label: c.name })),
    ...((isNCR && selectedRegionCode) || selectedProvinceCode
      ? [{ value: 'OTHER', label: '➕ Other / Enter Custom City / Municipality...' }]
      : []),
  ];

  const barangayOptions = [
    ...availableBarangays.map((b) => ({ value: b.code, label: b.name })),
    ...(selectedCityCode
      ? [{ value: 'OTHER', label: '➕ Other / Enter Custom Barangay Name...' }]
      : []),
  ];

  return (
    <div className="space-y-3 p-3 sm:p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2]">
      <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2]">
        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2d6a4f]" />
        <span className="text-[10px] sm:text-xs font-extrabold text-[#1b4332] uppercase tracking-wider flex items-center gap-1">
          Permanent Address <span className="text-rose-500">*</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
        {/* 1. Region Dropdown */}
        <CustomSelect
          label="Region"
          required
          disabled={disabled}
          value={selectedRegionCode}
          onChange={handleRegionChange}
          options={regionOptions}
          placeholder="Select Region..."
          searchable
        />

        {/* 2. Province Dropdown (Disabled if NCR or Region not selected) */}
        <div className="space-y-1">
          {isNCR ? (
            <div>
              <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Province</label>
              <input
                disabled
                type="text"
                value="Metro Manila (NCR - No Province)"
                className="w-full px-2.5 py-2 sm:py-2.5 rounded-xl bg-[#e8f5e9] border border-[#b7e4c7] text-[#1b4332] text-[10px] sm:text-xs font-extrabold cursor-not-allowed italic"
              />
            </div>
          ) : (
            <>
              <CustomSelect
                label="Province"
                required={!isNCR}
                disabled={disabled || !selectedRegionCode}
                value={selectedProvinceCode}
                onChange={handleProvinceChange}
                options={provinceOptions}
                placeholder={!selectedRegionCode ? 'Select Region first' : 'Select Province...'}
                searchable
              />
              {selectedProvinceCode === 'OTHER' && (
                <div className="pt-1.5 animate-fadeIn">
                  <label className="text-[10px] sm:text-xs font-bold text-[#2d6a4f] block mb-1">
                    Enter Custom Province Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    disabled={disabled}
                    type="text"
                    value={customProvince}
                    onChange={(e) => setCustomProvince(e.target.value)}
                    placeholder="e.g. Province Name"
                    className="w-full px-2.5 py-2 sm:py-2.5 rounded-xl bg-white border border-[#2d6a4f] text-[#1b4332] text-[10px] sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20 placeholder:text-gray-400"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* 3. City / Municipality Dropdown */}
        <div className="space-y-1">
          <CustomSelect
            label="City / Municipality"
            required
            disabled={
              disabled ||
              !selectedRegionCode ||
              (!isNCR && !selectedProvinceCode)
            }
            value={selectedCityCode}
            onChange={handleCityChange}
            options={cityOptions}
            placeholder={
              !selectedRegionCode
                ? 'Select Region first'
                : !isNCR && !selectedProvinceCode
                ? 'Select Province first'
                : 'Select City / Municipality...'
            }
            searchable
          />
          {selectedCityCode === 'OTHER' && (
            <div className="pt-1.5 animate-fadeIn">
              <label className="text-[10px] sm:text-xs font-bold text-[#2d6a4f] block mb-1">
                Enter Custom City / Municipality Name <span className="text-rose-500">*</span>
              </label>
              <input
                disabled={disabled}
                type="text"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="e.g. City or Municipality Name"
                className="w-full px-2.5 py-2 sm:py-2.5 rounded-xl bg-white border border-[#2d6a4f] text-[#1b4332] text-[10px] sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20 placeholder:text-gray-400"
              />
            </div>
          )}
        </div>

        {/* 4. Barangay Dropdown */}
        <div className="space-y-1">
          <CustomSelect
            label="Barangay"
            required
            disabled={disabled || !selectedCityCode || availableCities.length === 0}
            value={selectedBarangayCode}
            onChange={(val) => {
              setSelectedBarangayCode(val);
              if (val !== 'OTHER') setCustomBarangay('');
            }}
            options={barangayOptions}
            placeholder={!selectedCityCode ? 'Select City first' : 'Select Barangay...'}
            searchable
          />

          {selectedBarangayCode === 'OTHER' && (
            <div className="pt-1.5 animate-fadeIn">
              <label className="text-[10px] sm:text-xs font-bold text-[#2d6a4f] block mb-1">
                Enter Custom Barangay Name <span className="text-rose-500">*</span>
              </label>
              <input
                disabled={disabled}
                type="text"
                value={customBarangay}
                onChange={(e) => setCustomBarangay(e.target.value)}
                placeholder="e.g. Barangay San Sebastian / Custom Subd."
                className="w-full px-2.5 py-2 sm:py-2.5 rounded-xl bg-white border border-[#2d6a4f] text-[#1b4332] text-[10px] sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20 placeholder:text-gray-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* 5. Street Address / Unit / House No. */}
      <div className="space-y-1">
        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
          Street Address / Unit / House No. / Building <span className="text-rose-500">*</span>
        </label>
        <input
          disabled={disabled}
          type="text"
          value={streetAddress}
          onChange={(e) => setStreetAddress(e.target.value)}
          placeholder="e.g. 469 Palm Drive, Villa Valderrama"
          className="w-full px-2.5 py-2 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f] focus:ring-2 focus:ring-[#2d6a4f]/20 placeholder:text-gray-400"
        />
      </div>
    </div>
  );
};
