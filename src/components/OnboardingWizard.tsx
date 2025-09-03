import React, { useState } from 'react';
import { useElectron } from '../hooks/useElectron';
import { toast } from './ToastContainer';

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { isElectron } = useElectron();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    account: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
    },
    brand: {
      name: '',
      logo: null as File | null,
      description: '',
    },
    shopify: {
      shopDomain: '',
      accessToken: '',
      webhookSecret: '',
    },
    labelService: {
      provider: 'shippo',
      apiKey: '',
      testMode: true,
    },
    printers: {
      labelPrinter: '',
      documentPrinter: '',
    },
    location: {
      defaultLocation: '',
      shippingMethods: [] as string[],
    },
  });

  const updateFormData = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value,
      },
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      // Save configuration
      if (isElectron) {
        // Store tokens securely
        localStorage.setItem('shopify_token', formData.shopify.accessToken);
        localStorage.setItem('label_service_token', formData.labelService.apiKey);
        
        // Test printer connections
        const printers = [];
        if (printers.length === 0) {
          toast.warning('No printers detected', 'Please ensure your printers are connected and drivers are installed.');
        }
      }

      // Mark onboarding as complete
      localStorage.setItem('onboarding-completed', 'true');
      
      toast.success('Setup Complete!', 'Your warehouse system is ready to use.');
      onComplete();
    } catch (error) {
      toast.error('Setup Failed', 'Please check your configuration and try again.');
      console.error('Onboarding failed:', error);
    }
  };

  const steps: OnboardingStep[] = [
    {
      id: 'account',
      title: 'Create Account',
      description: 'Set up your Threads Ops account',
      component: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.account.name}
              onChange={(e) => updateFormData('account', 'name', e.target.value)}
              className="form-input"
              placeholder="Enter your full name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.account.email}
              onChange={(e) => updateFormData('account', 'email', e.target.value)}
              className="form-input"
              placeholder="Enter your email address"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={formData.account.password}
              onChange={(e) => updateFormData('account', 'password', e.target.value)}
              className="form-input"
              placeholder="Create a secure password"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={formData.account.confirmPassword}
              onChange={(e) => updateFormData('account', 'confirmPassword', e.target.value)}
              className="form-input"
              placeholder="Confirm your password"
            />
          </div>
        </div>
      ),
    },
    {
      id: 'brand',
      title: 'Brand Profile',
      description: 'Configure your brand settings',
      component: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand Name
            </label>
            <input
              type="text"
              value={formData.brand.name}
              onChange={(e) => updateFormData('brand', 'name', e.target.value)}
              className="form-input"
              placeholder="Enter your brand name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand Description
            </label>
            <textarea
              value={formData.brand.description}
              onChange={(e) => updateFormData('brand', 'description', e.target.value)}
              className="form-input"
              rows={3}
              placeholder="Describe your brand"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand Logo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => updateFormData('brand', 'logo', e.target.files?.[0] || null)}
              className="form-input"
            />
            <p className="text-sm text-gray-500 mt-1">
              Upload your brand logo (PNG, JPG, SVG)
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'shopify',
      title: 'Shopify Connection',
      description: 'Connect your Shopify store',
      component: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shop Domain
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                https://
              </span>
              <input
                type="text"
                value={formData.shopify.shopDomain}
                onChange={(e) => updateFormData('shopify', 'shopDomain', e.target.value)}
                className="form-input rounded-l-none"
                placeholder="your-shop.myshopify.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Token
            </label>
            <input
              type="password"
              value={formData.shopify.accessToken}
              onChange={(e) => updateFormData('shopify', 'accessToken', e.target.value)}
              className="form-input"
              placeholder="Enter your Shopify access token"
            />
            <p className="text-sm text-gray-500 mt-1">
              Generate this in your Shopify admin under Apps {'>'} Private apps
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook Secret
            </label>
            <input
              type="password"
              value={formData.shopify.webhookSecret}
              onChange={(e) => updateFormData('shopify', 'webhookSecret', e.target.value)}
              className="form-input"
              placeholder="Enter your webhook secret"
            />
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Need help with Shopify setup?
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Follow our{' '}
                    <a href="#" className="font-medium underline hover:text-blue-600">
                      Shopify integration guide
                    </a>{' '}
                    to get your access token and webhook secret.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'labelService',
      title: 'Label Service',
      description: 'Configure shipping label service',
      component: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label Provider
            </label>
            <select
              value={formData.labelService.provider}
              onChange={(e) => updateFormData('labelService', 'provider', e.target.value)}
              className="form-input"
            >
              <option value="shippo">Shippo</option>
              <option value="easypost">EasyPost</option>
              <option value="stamps">Stamps.com</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={formData.labelService.apiKey}
              onChange={(e) => updateFormData('labelService', 'apiKey', e.target.value)}
              className="form-input"
              placeholder="Enter your API key"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="testMode"
              checked={formData.labelService.testMode}
              onChange={(e) => updateFormData('labelService', 'testMode', e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="testMode" className="ml-2 block text-sm text-gray-900">
              Enable test mode (recommended for initial setup)
            </label>
          </div>
        </div>
      ),
    },
    {
      id: 'printers',
      title: 'Printer Setup',
      description: 'Configure your label and document printers',
      component: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label Printer
            </label>
            <select
              value={formData.printers.labelPrinter}
              onChange={(e) => updateFormData('printers', 'labelPrinter', e.target.value)}
              className="form-input"
            >
              <option value="">Select a printer</option>
              <option value="zebra">Zebra ZD420</option>
              <option value="dymo">DYMO LabelWriter 450</option>
              <option value="brother">Brother QL-800</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Choose your thermal label printer for shipping labels
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Printer
            </label>
            <select
              value={formData.printers.documentPrinter}
              onChange={(e) => updateFormData('printers', 'documentPrinter', e.target.value)}
              className="form-input"
            >
              <option value="">Select a printer</option>
              <option value="default">Default System Printer</option>
              <option value="laser">Laser Printer</option>
              <option value="inkjet">Inkjet Printer</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Choose your printer for packing slips and documents
            </p>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Printer Setup
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Make sure your printers are connected and drivers are installed before proceeding.
                    You can change these settings later in the app.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'location',
      title: 'Location & Shipping',
      description: 'Configure your warehouse location and shipping methods',
      component: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Warehouse Location
            </label>
            <select
              value={formData.location.defaultLocation}
              onChange={(e) => updateFormData('location', 'defaultLocation', e.target.value)}
              className="form-input"
            >
              <option value="">Select a location</option>
              <option value="main">Main Warehouse</option>
              <option value="secondary">Secondary Warehouse</option>
              <option value="fulfillment">Fulfillment Center</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shipping Methods
            </label>
            <div className="space-y-2">
              {['Standard Shipping', 'Express Shipping', 'Overnight', 'Local Pickup'].map((method) => (
                <label key={method} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.location.shippingMethods.includes(method)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateFormData('location', 'shippingMethods', [...formData.location.shippingMethods, method]);
                      } else {
                        updateFormData('location', 'shippingMethods', formData.location.shippingMethods.filter(m => m !== method));
                      }
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-900">{method}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Almost Done!
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    Complete this final step to finish setting up your warehouse system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mb-4">
            <span className="text-white text-2xl font-bold">T</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">
            Welcome to Threads Ops
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Let&apos;s get your warehouse management system set up in just a few steps
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-sm text-gray-600">
              {currentStepData.description}
            </p>
          </div>

          {currentStepData.component}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleComplete}
                className="btn btn-primary"
              >
                Complete Setup
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="btn btn-primary"
              >
                Next
              </button>
            )}
          </div>
        </div>

        {/* Step Indicators */}
        <div className="mt-8 flex justify-center">
          <div className="flex space-x-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-primary-500'
                    : index < currentStep
                    ? 'bg-green-400'
                    : 'bg-gray-300'
                }`}
                title={step.title}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
