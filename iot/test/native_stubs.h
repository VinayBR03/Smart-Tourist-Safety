#ifdef NATIVE_BUILD 

#ifndef NATIVE_STUBS_H
#define NATIVE_STUBS_H

#include <stdint.h>
#include <stdio.h>
#include <stdarg.h>

// Mock Arduino functions for PC
inline unsigned long millis() { return 0; }
inline void delay(unsigned long ms) { (void)ms; }
#define F(x) (x)

#ifndef isnan
#define isnan(x) __builtin_isnan(x)
#endif

struct FakeSerial {
    void println(const char* s) { ::puts(s ? s : ""); }
    void println(int i) { ::printf("%d\n", i); }
    void print(const char* s) { ::printf("%s", s ? s : ""); }
    void printf(const char* fmt, ...) {
        va_list args;
        va_start(args, fmt);
        ::vprintf(fmt, args);
        va_end(args);
    }
    explicit operator bool() const { return true; }
};

inline FakeSerial Serial;

// Unity needs these defined for the Linker on PC
extern "C" {
    void setUp(void) {}
    void tearDown(void) {}
}

#endif 
#endif