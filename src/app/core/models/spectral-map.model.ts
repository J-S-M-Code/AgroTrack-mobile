export interface SpectralMap {
    idMap?: string;
    minioRawPath: string;
    tilesBaseUrl?: string;
    flightDate: string;
    indexType: 'NDVI' | 'GNDVI' | 'OSAVI' | 'NDRE' | 'LCI' | 'RGB';
    cloudCoverPercentage?: number;
    resolutionGSD?: number;
    meanIndexValue?: number;
    description?: string;
    mapStatus?: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';
}
