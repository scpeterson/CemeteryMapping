"""Offline GEOS 3.14+ worker; only stdin/stdout, no database connection."""
import ctypes as ct
import ctypes.util
import json
import sys


def clean(payload):
    geos = ct.CDLL(ctypes.util.find_library('geos_c'))
    pointer = ct.c_void_p

    def bind(name, result, *args):
        function = getattr(geos, name)
        function.restype = result
        function.argtypes = args
        return function

    version = bind('GEOSversion', ct.c_char_p)().decode()
    bind('initGEOS', None, pointer, pointer)(None, None)
    read = bind('GEOSGeomFromWKB_buf', pointer, ct.c_char_p, ct.c_size_t)
    collection = bind('GEOSGeom_createCollection', pointer, ct.c_int, ct.POINTER(pointer), ct.c_uint)
    params = bind('GEOSCoverageCleanParams_create', pointer)()
    destroy = bind('GEOSGeom_destroy', None, pointer)
    destroy_params = bind('GEOSCoverageCleanParams_destroy', None, pointer)
    source = result = None
    try:
        for suffix, value in [('SnappingDistance', payload['snap']), ('GapMaximumWidth', payload['gap'])]:
            if not bind('GEOSCoverageCleanParams_set' + suffix, ct.c_int, pointer, ct.c_double)(params, value):
                raise RuntimeError('Invalid coverage parameter')
        records = payload['records']
        geometries = []
        for record in records:
            raw = bytes.fromhex(record['wkb'])
            geometry = read(raw, len(raw))
            if not geometry:
                raise RuntimeError('Invalid input WKB')
            geometries.append(geometry)
        source = collection(7, (pointer * len(geometries))(*geometries), len(geometries))
        if not source:
            raise RuntimeError('Cannot create coverage collection')
        result = bind('GEOSCoverageCleanWithParams', pointer, pointer, pointer)(source, params)
        if not result:
            raise RuntimeError('Coverage cleaning failed')
        count = bind('GEOSGetNumGeometries', ct.c_int, pointer)(result)
        if count != len(records):
            raise RuntimeError('Coverage cleaning changed record cardinality')
        get = bind('GEOSGetGeometryN', pointer, pointer, ct.c_int)
        write = bind('GEOSGeomToWKB_buf', pointer, pointer, ct.POINTER(ct.c_size_t))
        free = bind('GEOSFree', None, pointer)
        output = []
        for index, record in enumerate(records):
            size = ct.c_size_t()
            raw = write(get(result, index), ct.byref(size))
            if not raw:
                raise RuntimeError('Cannot serialize candidate')
            try:
                output.append({'id': record['id'], 'ewkb': ct.string_at(raw, size.value).hex()})
            finally:
                free(raw)
        return {'geos': version, 'records': output}
    finally:
        if result:
            destroy(result)
        if source:
            destroy(source)
        destroy_params(params)
        bind('finishGEOS', None)()


if __name__ == '__main__':
    try:
        print(json.dumps(clean(json.load(sys.stdin))))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
