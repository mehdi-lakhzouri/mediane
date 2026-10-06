import { Command, CommandRunner, Option } from 'nest-commander';
import { AppError } from '../../common/errors';
import { Email } from '../../common/domain/email';
import { DevicesService } from '../../modules/devices/application/devices.service';
import { UserRepository } from '../../modules/users/domain/user.repository';

interface RegisterDeviceOptions {
  serial?: string;
  label?: string;
  driver?: string;
}

/**
 * npm run cli -- device:register --serial CG-0001 --label "Truck 12" [--driver driver@x.tn]
 *
 * Registers an in-cabin unit and optionally pairs it with a driver. The
 * signing secret is printed once, to load into the unit (or the simulator).
 */
@Command({
  name: 'device:register',
  description: 'Register an in-cabin unit and print its signing secret once',
})
export class RegisterDeviceCommand extends CommandRunner {
  constructor(
    private readonly devices: DevicesService,
    private readonly users: UserRepository,
  ) {
    super();
  }

  async run(_params: string[], options: RegisterDeviceOptions): Promise<void> {
    if (!options.serial || !options.label) {
      this.fail('--serial and --label are required.');
      return;
    }
    try {
      const actor = { adminId: null };
      const { device, secret } = await this.devices.register(
        { serialNumber: options.serial, label: options.label },
        actor,
      );
      console.log(
        `Device registered: ${device.serialNumber} (id: ${device.id})`,
      );
      if (options.driver) {
        const driver = await this.users.findByEmail(
          Email.create(options.driver),
        );
        if (!driver) {
          this.fail(
            `No account for ${options.driver}; the unit stays unpaired.`,
          );
        } else {
          await this.devices.pair(device.id, driver.id, actor);
          console.log(`Paired with ${options.driver}`);
        }
      }
      console.log('');
      console.log('Signing secret (shown once, store it in the unit):');
      console.log(secret);
    } catch (error) {
      this.fail(error instanceof AppError ? error.message : String(error));
    }
  }

  @Option({ flags: '--serial <serial>', description: 'Unit serial number' })
  parseSerial(value: string): string {
    return value.trim();
  }

  @Option({ flags: '--label <label>', description: 'Human-readable label' })
  parseLabel(value: string): string {
    return value.trim();
  }

  @Option({
    flags: '--driver <email>',
    description: 'Pair with this driver right away',
  })
  parseDriver(value: string): string {
    return value.trim();
  }

  private fail(message: string): void {
    console.error(message);
    process.exitCode = 1;
  }
}
